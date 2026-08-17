// GET /api/zernio/ads?since=&until=
// Mídia paga real (Zernio). Para cada conta com ads conectado, lista as ad accounts
// e puxa insights (total + por campanha). Consolidação/geral é feita no cliente.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { listAdAccounts, adsInsights, type AdInsightRow } from "@/lib/zernio";
import { listWorkspaceAccounts } from "@/lib/profiles";

export const dynamic = "force-dynamic";

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
// predicados de action_type — reusados por total e por campanha (mesma definição = campanhas
// somam de forma consistente com o total da conta)
const isLead = (t: string) => t.includes("lead");
const isForm = (t: string) => t.includes("complete_registration") || t === "lead";
const isMessaging = (t: string) => t.includes("messaging") && (t.includes("connection") || t.includes("started"));
const isLandingView = (t: string) => t.includes("landing_page_view");

function totalsFrom(row: AdInsightRow | undefined) {
  if (!row) return null;
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const leads = sumActions(row.actions, isLead);
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

    const accounts = await listWorkspaceAccounts(ws); // agrega profiles (multi-conta)
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
                const leads = sumActions(c.actions, isLead);
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

    // dedup por ad account id (facebook + instagram da mesma conexão Meta listam os mesmos act_)
    const byId = new Map<string, (typeof perConn)[number][number]>();
    for (const a of perConn.flat()) {
      if (!a.totals || (a.totals.spend <= 0 && a.totals.impressions <= 0)) continue;
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    return NextResponse.json({ ok: true, accounts: [...byId.values()] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 502 });
  }
}
