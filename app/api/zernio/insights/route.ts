// GET /api/zernio/insights?platform=&accountId=&since=&until=
// Combinado numa chamada, montado POR PLATAFORMA a partir do endpoint CERTO de cada rede:
//   instagram/facebook → account-insights (séries) + follower-history + daily-metrics + posts +
//     link-taps + stories + demografia + best-time
//   tiktok             → account-insights (6 contadores) + daily-metrics + posts + best-time
//   youtube            → channel-insights (views/tempo/inscritos) + demografia (SEM série/posts)
//   linkedin           → linkedin-aggregate (lifetime) (SEM série/posts)
//   threads            → sem analytics (só followersCount, resolvido no componente)
// O shape entregue ao painel é sempre { insights:{metrics:{[k]:{total,values}}}, followers, keySeries,
// daily, top, content, linkTaps, stories, bestTime, demographics }.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import {
  accountInsightsFull, followerHistory, keyMetricSeries, dailyMetrics,
  postAnalytics, profileLinkTaps, listStories, bestTime, demographics,
  youtubeChannelInsights, linkedinAggregate,
  type PostAnalyticsItem, type AnalyticsResponse, type AnalyticsMetric,
  type YoutubeChannelInsights, type LinkedinAggregate,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const interactions = (a: PostAnalyticsItem["analytics"]) => n(a?.likes) + n(a?.comments) + n(a?.shares) + n(a?.saves);

// converte totais simples ({k:{total}} ou {k:number}) no envelope AnalyticsResponse do painel
function toInsights(
  platform: string, accountId: string, raw: Record<string, { total: number } | number> | undefined,
  range: { since?: string; until?: string }
): AnalyticsResponse | null {
  if (!raw) return null;
  const metrics: Record<string, AnalyticsMetric> = {};
  for (const [k, v] of Object.entries(raw)) {
    metrics[k] = { total: n(typeof v === "number" ? v : v?.total), values: [] };
  }
  return {
    success: true, accountId, platform,
    dateRange: { since: range.since || "", until: range.until || "" },
    metricType: "total_value", metrics,
  };
}

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
    const range = { since, until };

    const isIG = platform === "instagram";
    // plataformas com posting/série (account-insights com série, daily-metrics, posts, best-time)
    const hasPosting = platform === "instagram" || platform === "facebook" || platform === "tiktok";
    // produção de conteúdo (posts publicados): tb youtube/linkedin têm posts, mesmo sem série diária
    const hasContent = hasPosting || platform === "youtube" || platform === "linkedin";
    // demografia disponível: instagram + youtube
    const hasDemo = platform === "instagram" || platform === "youtube";

    // insights por PLATAFORMA (endpoint certo → envelope uniforme)
    const insightsP: Promise<AnalyticsResponse | null> =
      platform === "youtube"
        ? youtubeChannelInsights(accountId, range)
            .then((r: YoutubeChannelInsights) => toInsights("youtube", accountId, r?.metrics, range))
            .catch(() => null)
        : platform === "linkedin"
          ? linkedinAggregate(accountId, range)
              .then((r: LinkedinAggregate) => toInsights("linkedin", accountId, r?.analytics, range))
              .catch(() => null)
          : platform === "threads"
            ? Promise.resolve<AnalyticsResponse | null>(null)
            : accountInsightsFull(platform, accountId, range).catch(() => null);

    const [insights, followers, keySeries, daily, postsResp, linkTaps, stories, bestSlots, demo] = await Promise.all([
      insightsP,
      hasPosting ? followerHistory(platform, accountId, range).catch(() => null) : Promise.resolve(null),
      hasPosting ? keyMetricSeries(platform, accountId, range).catch(() => null) : Promise.resolve(null),
      hasPosting ? dailyMetrics(accountId, platform, { fromDate: since, toDate: until }).catch(() => null) : Promise.resolve(null),
      hasContent ? postAnalytics({ accountId, platform, fromDate: since, toDate: until, sortBy: "engagement", limit: 100 }).catch(() => null) : Promise.resolve(null),
      isIG ? profileLinkTaps(accountId, range).catch(() => null) : Promise.resolve(null),
      isIG ? listStories(accountId).then((s) => s.length).catch(() => null) : Promise.resolve(null),
      hasPosting ? bestTime(accountId, platform, { fromDate: since, toDate: until }).catch(() => null) : Promise.resolve(null),
      hasDemo ? demographics(accountId, { platform }).catch(() => null) : Promise.resolve(null),
    ]);

    const posts = postsResp?.posts || [];
    const top = postsResp ? { overview: postsResp.overview, posts: posts.slice(0, 8) } : null;
    const content = postsResp ? contentSummary(posts) : null;

    return NextResponse.json({ insights, followers, keySeries, daily, top, content, linkTaps, stories, bestTime: bestSlots, demographics: demo });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
