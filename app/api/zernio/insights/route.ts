// GET /api/zernio/insights?platform=&accountId=&since=&until=
// Combinado numa chamada: métricas de conta + histórico de seguidores + série diária
// da métrica-chave + série diária agregada (daily-metrics) + posts (posting analytics:
// top conteúdos + resumo orgânico/pago + mix por tipo) + toques em links por tipo +
// stories ativos + demografia (IG).
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import {
  accountInsightsFull, followerHistory, keyMetricSeries, dailyMetrics,
  postAnalytics, profileLinkTaps, listStories, bestTime, demographics, type PostAnalyticsItem,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const interactions = (a: PostAnalyticsItem["analytics"]) => n(a?.likes) + n(a?.comments) + n(a?.shares) + n(a?.saves);

// resumo de conteúdo: orgânico vs impulsionado + mix por tipo de mídia
function contentSummary(posts: PostAnalyticsItem[]) {
  const bucket = () => ({ count: 0, reach: 0, engagement: 0 });
  const organic = bucket(), paid = bucket();
  const byType: Record<string, number> = { video: 0, image: 0, carousel: 0, other: 0 };
  for (const p of posts) {
    const isAd = (p as { isAd?: boolean }).isAd === true;
    const b = isAd ? paid : organic;
    b.count++; b.reach += n(p.analytics?.reach); b.engagement += interactions(p.analytics);
    const t = String((p as { mediaType?: string }).mediaType || "other").toLowerCase();
    byType[t in byType ? t : "other"]++;
  }
  const totReach = organic.reach + paid.reach;
  return { total: posts.length, organic, paid, byType, organicShare: totReach ? organic.reach / totReach : null };
}

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
    const isIG = platform === "instagram";

    const [insights, followers, keySeries, daily, postsResp, linkTaps, stories, bestSlots, demo] = await Promise.all([
      accountInsightsFull(platform, accountId, { since, until }).catch(() => null),
      followerHistory(platform, accountId, { since, until }).catch(() => null),
      keyMetricSeries(platform, accountId, { since, until }).catch(() => null),
      dailyMetrics(accountId, platform, { fromDate: since, toDate: until }).catch(() => null),
      postAnalytics({ accountId, platform, fromDate: since, toDate: until, sortBy: "engagement", limit: 100 }).catch(() => null),
      isIG ? profileLinkTaps(accountId, { since, until }).catch(() => null) : Promise.resolve(null),
      isIG ? listStories(accountId).then((s) => s.length).catch(() => null) : Promise.resolve(null),
      bestTime(accountId, platform, { fromDate: since, toDate: until }).catch(() => null),
      isIG ? demographics(accountId).catch(() => null) : Promise.resolve(null),
    ]);

    const posts = postsResp?.posts || [];
    const top = postsResp ? { overview: postsResp.overview, posts: posts.slice(0, 8) } : null;
    const content = postsResp ? contentSummary(posts) : null;

    return NextResponse.json({ insights, followers, keySeries, daily, top, content, linkTaps, stories, bestTime: bestSlots, demographics: demo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
