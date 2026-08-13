// GET /api/zernio/ads?since=&until=
// Mídia paga real (Zernio). Para cada conta com ads conectado, lista as ad accounts
// e puxa insights (total + por campanha). Consolidação/geral é feita no cliente.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { listAccounts, listAdAccounts, adsInsights, type AdInsightRow } from "@/lib/zernio";

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

function totalsFrom(row: AdInsightRow | undefined) {
  if (!row) return null;
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const leads = sumActions(row.actions, (t) => t.includes("lead"));
  const messaging = sumActions(row.actions, (t) => t.includes("messaging") && (t.includes("connection") || t.includes("started")));
  const linkClicks = num(row.inline_link_clicks) || sumActions(row.actions, (t) => t === "link_click");
  const purchases = sumActions(row.actions, (t) => t.includes("purchase"));
  return {
    spend, impressions, clicks,
    ctr: num(row.ctr), cpc: num(row.cpc), cpm: num(row.cpm),
    reach: num(row.reach), frequency: num(row.frequency),
    linkClicks, leads, messaging, purchases,
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

    const { accounts } = await listAccounts(ws.zernioProfileId);
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
              adsInsights(conn._id, act.id, { since, until, level: "campaign", fields: "campaign_name,impressions,spend,clicks,ctr,actions" })
                .then((d) => d.data || []).catch(() => [] as AdInsightRow[]),
            ]);
            const totals = totalsFrom(tot);
            const campaigns = camp
              .map((c) => ({
                name: c.campaign_name || "—",
                spend: num(c.spend), impressions: num(c.impressions), clicks: num(c.clicks),
                ctr: num(c.ctr), leads: sumActions(c.actions, (t) => t.includes("lead")),
              }))
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

    // só ad accounts com algum investimento/impressão no período (evita ruído de contas vazias)
    const flat = perConn.flat().filter((a) => a.totals && (a.totals.spend > 0 || a.totals.impressions > 0));
    return NextResponse.json({ ok: true, accounts: flat });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 502 });
  }
}
