// GET /api/zernio/insights?platform=&accountId=&since=&until=
// Combinado numa chamada: métricas de conta (todas) + histórico de seguidores +
// série diária da métrica-chave + série diária agregada (daily-metrics) +
// top conteúdos (posting analytics) + demografia (IG).
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { accountInsightsFull, followerHistory, keyMetricSeries, dailyMetrics, postAnalytics, demographics } from "@/lib/zernio";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const q = new URL(req.url).searchParams;
    const platform = q.get("platform");
    const accountId = q.get("accountId");
    if (!platform || !accountId) return NextResponse.json({ error: "platform/accountId ausentes" }, { status: 400 });
    const since = q.get("since") ?? undefined;
    const until = q.get("until") ?? undefined;

    const [insights, followers, keySeries, daily, top, demo] = await Promise.all([
      accountInsightsFull(platform, accountId, { since, until }).catch(() => null),
      followerHistory(platform, accountId, { since, until }).catch(() => null),
      keyMetricSeries(platform, accountId, { since, until }).catch(() => null),
      dailyMetrics(accountId, platform, { fromDate: since, toDate: until }).catch(() => null),
      postAnalytics({ accountId, platform, fromDate: since, toDate: until, sortBy: "engagement", limit: 8 }).catch(() => null),
      platform === "instagram" ? demographics(accountId).catch(() => null) : Promise.resolve(null),
    ]);

    return NextResponse.json({ insights, followers, keySeries, daily, top, demographics: demo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
