// GET /api/zernio/ads?since=&until=
// Mídia paga real (Zernio). Para cada conta com ads conectado, lista as ad accounts
// e puxa insights (total + por campanha). Consolidação/geral é feita no cliente.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { listAdAccounts, adsInsights, googleAdsInsights, type AdInsightRow } from "@/lib/zernio";
import { listWorkspaceAccounts } from "@/lib/profiles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60; // muitas chamadas ao provedor (Meta + Google GAQL por cliente); evita corte prematuro

// ── Google Ads (GAQL) — parsing defensivo do passthrough do Google ──
const gnum = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// a resposta pode vir como { results: [...] } | { data: [...] } | { rows: [...] }
function gRows(resp: unknown): Record<string, unknown>[] {
  const r = resp as Record<string, unknown> | null;
  const arr = (r?.results ?? r?.data ?? r?.rows) as unknown;
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}
// lê metrics.cost_micros (ou costMicros) etc., tolerando camel/snake
function gField(m: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) if (m[k] != null) return gnum(m[k]);
  return 0;
}
function parseGoogleCampaign(row: Record<string, unknown>) {
  const camp = (row.campaign as Record<string, unknown>) || {};
  const m = (row.metrics as Record<string, unknown>) || {};
  const spend = gField(m, "cost_micros", "costMicros") / 1_000_000;
  const impressions = gField(m, "impressions");
  const clicks = gField(m, "clicks");
  const conv = gField(m, "conversions");
  return {
    name: String(camp.name || "—"), objective: "",
    spend, impressions, clicks,
    ctr: impressions ? (clicks / impressions) * 100 : 0,
    cpc: clicks ? spend / clicks : 0,
    cpm: impressions ? (spend / impressions) * 1000 : 0,
    reach: 0, frequency: 0, inlineLinkClicks: clicks,
    leads: conv, forms: conv, messaging: 0, landingViews: 0,
    cpl: conv ? spend / conv : 0,
  };
}
function googleTotals(camps: ReturnType<typeof parseGoogleCampaign>[]) {
  const t = camps.reduce((a, c) => ({ spend: a.spend + c.spend, impressions: a.impressions + c.impressions, clicks: a.clicks + c.clicks, leads: a.leads + c.leads }), { spend: 0, impressions: 0, clicks: 0, leads: 0 });
  return {
    spend: t.spend, impressions: t.impressions, clicks: t.clicks,
    ctr: t.impressions ? (t.clicks / t.impressions) * 100 : 0,
    cpc: t.clicks ? t.spend / t.clicks : 0,
    cpm: t.impressions ? (t.spend / t.impressions) * 1000 : 0,
    reach: 0, frequency: 0, linkClicks: t.clicks, leads: t.leads,
    messaging: 0, purchases: 0, landingViews: 0, postEngagement: 0,
    reactions: 0, comments: 0, videoViews: 0,
    cpl: t.leads ? t.spend / t.leads : 0,
  };
}

// plataformas de posting que expõem ad accounts (Meta cobre facebook/instagram)
const ADS_PLATFORMS = new Set(["facebook", "instagram"]);

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// soma valores de actions cujo action_type casa com o predicado
function sumActions(actions: AdInsightRow["actions"], match: (t: string) => boolean): number {
  if (!actions) return 0;
  return actions.reduce((s, a) => (match(a.action_type) ? s + num(a.value) : s), 0);
}
// LEADS (Meta) — SEM dupla contagem. O Meta devolve vários action_types de lead que se SOBREPÕEM:
// o MESMO lead aparece como "lead", "onsite_conversion.lead_grouped" E "offsite_conversion.fb_pixel_lead".
// Somar todos (o antigo t.includes("lead")) contava o lead 2-3x — era a causa do número inflado (ex.: 449).
// Regra: usa o TOTAL unificado do Meta (action_type EXATO "lead" = o que o Gerenciador mostra em
// "Resultados: Leads"); só quando ele não existe é que soma as FONTES distintas (form on-facebook + pixel
// do site), evitando os agregados "_grouped" que duplicam.
function leadsOf(actions: AdInsightRow["actions"]): number {
  if (!actions?.length) return 0;
  const exact = actions.find((a) => a.action_type === "lead");
  if (exact) return num(exact.value);
  const FONTES = new Set(["onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen.other"]);
  return actions.reduce((s, a) => (FONTES.has(a.action_type) ? s + num(a.value) : s), 0);
}
// predicados de action_type — reusados por total e por campanha (mesma definição = campanhas
// somam de forma consistente com o total da conta)
const isForm = (t: string) => t.includes("complete_registration") || t === "lead";
const isMessaging = (t: string) => t.includes("messaging") && (t.includes("connection") || t.includes("started"));
const isLandingView = (t: string) => t.includes("landing_page_view");

function totalsFrom(row: AdInsightRow | undefined) {
  if (!row) return null;
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const leads = leadsOf(row.actions);
  const messaging = sumActions(row.actions, isMessaging);
  const linkClicks = num(row.inline_link_clicks) || sumActions(row.actions, (t) => t === "link_click");
  const purchases = sumActions(row.actions, (t) => t.includes("purchase"));
  const landingViews = sumActions(row.actions, isLandingView);
  const postEngagement = sumActions(row.actions, (t) => t === "post_engagement");
  const reactions = sumActions(row.actions, (t) => t === "post_reaction");
  const comments = sumActions(row.actions, (t) => t === "comment");
  const videoViews = sumActions(row.actions, (t) => t.includes("video_view"));
  return {
    spend, impressions, clicks,
    ctr: num(row.ctr), cpc: num(row.cpc), cpm: num(row.cpm),
    reach: num(row.reach), frequency: num(row.frequency),
    linkClicks, leads, messaging, purchases,
    landingViews, postEngagement, reactions, comments, videoViews,
    cpl: leads ? spend / leads : 0,
  };
}

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    if (!ws.zernioProfileId) return NextResponse.json({ ok: true, accounts: [] });

    const q = new URL(req.url).searchParams;
    const since = q.get("since") ?? undefined;
    const until = q.get("until") ?? undefined;
    const debug = q.get("debug") === "1";

    const accounts = await listWorkspaceAccounts(ws); // agrega profiles (multi-conta)

    // diagnóstico: por que Google Ads (ou Meta) não aparece? Lista status por conexão.
    if (debug) {
      const isG = (p: string) => { const s = p.toLowerCase(); return s.includes("google") && s.includes("ads"); };
      const gAccts = accounts.filter((a) => isG(String(a.platform || "")));
      const gDetail = await Promise.all(gAccts.map(async (a) => {
        const status = (a as { adsStatus?: string; status?: string }).adsStatus ?? (a as { status?: string }).status;
        const st = String(status ?? "").toLowerCase();
        const conectado = st !== "disconnected" && st !== "revoked" && st !== "error" && st !== "expired";
        let customers: unknown = "não consultado (status não conectado)";
        let gaqlSample: unknown = null;
        if (conectado && since && until) {
          const custs = await listAdAccounts(a._id).then((d) => d.accounts).catch((e) => ({ erro: String(e).slice(0, 120) }));
          customers = custs;
          const first = Array.isArray(custs) ? custs[0] : null;
          if (first) {
            const gaql = `SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`;
            gaqlSample = await googleAdsInsights(a._id, first.id, gaql).then((r) => ({ chaves: Object.keys(r || {}), linhas: gRows(r).length, amostra: gRows(r).slice(0, 2) })).catch((e) => ({ erro: String(e).slice(0, 160) }));
          }
        }
        return { _id: a._id, adsStatus: status, conectado, customers, gaqlSample };
      }));
      return NextResponse.json({
        ok: true, debug: true,
        totalContas: accounts.length,
        plataformas: accounts.map((a) => ({ platform: a.platform, adsStatus: (a as { adsStatus?: string }).adsStatus })),
        googleAds: gDetail,
      });
    }
    const adConnected = accounts.filter(
      (a) => ADS_PLATFORMS.has(a.platform) && (a.adsStatus === "connected" || a.adsStatus === "active")
    );

    // dedup por _id (uma conexão Meta pode aparecer em facebook e instagram)
    const seen = new Set<string>();
    const conns = adConnected.filter((a) => (seen.has(a._id) ? false : (seen.add(a._id), true)));

    const perConn = await Promise.all(
      conns.map(async (conn) => {
        const adAccts = await listAdAccounts(conn._id).then((d) => d.accounts).catch(() => []);
        const usable = adAccts.filter((a) => a.selectable !== false);
        const built = await Promise.all(
          usable.map(async (act) => {
            const [tot, camp] = await Promise.all([
              adsInsights(conn._id, act.id, { since, until }).then((d) => d.data?.[0]).catch(() => undefined),
              adsInsights(conn._id, act.id, {
                since, until, level: "campaign",
                fields: "campaign_name,objective,impressions,spend,clicks,ctr,cpc,cpm,reach,frequency,actions,inline_link_clicks",
              })
                .then((d) => d.data || []).catch(() => [] as AdInsightRow[]),
            ]);
            const totals = totalsFrom(tot);
            const campaigns = camp
              .map((c) => {
                const spend = num(c.spend);
                const leads = leadsOf(c.actions);
                return {
                  name: c.campaign_name || "—",
                  objective: typeof c.objective === "string" ? c.objective : "",
                  spend, impressions: num(c.impressions), clicks: num(c.clicks),
                  ctr: num(c.ctr), cpc: num(c.cpc), cpm: num(c.cpm),
                  reach: num(c.reach), frequency: num(c.frequency),
                  inlineLinkClicks: num(c.inline_link_clicks),
                  leads,
                  forms: sumActions(c.actions, isForm),
                  messaging: sumActions(c.actions, isMessaging),
                  landingViews: sumActions(c.actions, isLandingView),
                  cpl: leads ? spend / leads : 0,
                };
              })
              .filter((c) => c.spend > 0 || c.impressions > 0)
              .sort((a, b) => b.spend - a.spend);
            return {
              zernioAccountId: conn._id,
              platform: "meta",
              id: act.id, name: act.name, currency: act.currency,
              totals, campaigns,
            };
          })
        );
        return built;
      })
    );

    // ── Google Ads (googleads) — caminho próprio via GAQL ──
    // Google Ads é conta STANDALONE (não add-on de posting como o Meta), então normalmente NÃO
    // tem `adsStatus`. Basta ela existir na lista de contas conectadas — a menos que o status
    // diga explicitamente que caiu. Tolerante a variações de nome (googleads/google_ads/google-ads).
    const isGoogleAds = (p: string) => { const s = p.toLowerCase(); return s.includes("google") && s.includes("ads"); };
    const gConnected = accounts.filter((a) => {
      if (!isGoogleAds(String(a.platform || ""))) return false;
      const st = String((a as { adsStatus?: string; status?: string }).adsStatus ?? (a as { status?: string }).status ?? "").toLowerCase();
      return st !== "disconnected" && st !== "revoked" && st !== "error" && st !== "expired";
    });
    const gseen = new Set<string>();
    const gConns = gConnected.filter((a) => (gseen.has(a._id) ? false : (gseen.add(a._id), true)));
    const gPer = (since && until) ? await Promise.all(gConns.map(async (conn) => {
      const custs = await listAdAccounts(conn._id).then((d) => d.accounts).catch(() => []);
      return Promise.all(custs.map(async (cust) => {
        const gaql = `SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`;
        const resp = await googleAdsInsights(conn._id, cust.id, gaql).catch(() => ({}));
        const camps = gRows(resp).map(parseGoogleCampaign).filter((c) => c.spend > 0 || c.impressions > 0).sort((a, b) => b.spend - a.spend);
        return { zernioAccountId: conn._id, platform: "googleads", id: cust.id, name: cust.name || cust.id, currency: cust.currency || "BRL", totals: googleTotals(camps), campaigns: camps };
      }));
    })) : [];

    // merge Meta + Google Ads, dedup por ad account id
    const allAccts = [...perConn.flat(), ...gPer.flat()];
    const byId = new Map<string, (typeof allAccts)[number]>();
    for (const a of allAccts) {
      const vazio = !a.totals || (a.totals.spend <= 0 && a.totals.impressions <= 0);
      // Google Ads: mostra mesmo vazio (confirma que a conexão foi identificada). Meta esconde vazio.
      if (vazio && a.platform !== "googleads") continue;
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    return NextResponse.json({ ok: true, accounts: [...byId.values()] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 502 });
  }
}
