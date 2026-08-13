// GET /api/zernio/insights?platform=&accountId=&since=&until=
// Combinado: account-insights (todas métricas) + follower-history + série diária da
// métrica-chave (reach/views/impressions) + demographics (IG) numa chamada.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { accountInsightsFull, followerHistory, keyMetricSeries, demographics } from "@/lib/zernio";

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

    const [insights, followers, keySeries, demo] = await Promise.all([
      accountInsightsFull(platform, accountId, { since, until }).catch(() => null),
      followerHistory(platform, accountId, { since, until }).catch(() => null),
      keyMetricSeries(platform, accountId, { since, until }).catch(() => null),
      platform === "instagram" ? demographics(accountId).catch(() => null) : Promise.resolve(null),
    ]);

    return NextResponse.json({ insights, followers, keySeries, demographics: demo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
