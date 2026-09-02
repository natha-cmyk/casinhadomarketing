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
import { cached } from "@/lib/ttl-cache";
import {
  accountInsightsFull, followerHistory, keyMetricSeries, dailyMetrics,
  postAnalytics, profileLinkTaps, listStories, bestTime, demographics,
  youtubeChannelInsights, linkedinAggregate,
  type PostAnalyticsItem, type AnalyticsResponse, type AnalyticsMetric,
  type YoutubeChannelInsights, type LinkedinAggregate,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

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

// ── Últimas publicações (grade recente do perfil, por DATA desc) ──
// Reusa os posts já buscados (postAnalytics) e ordena por publishedAt desc.
// O item da API traz campos de mídia além do tipado (thumbnail/mediaUrl/permalink) —
// lidos de forma tolerante ao shape.
export interface RecentPost {
  _id: string;
  url: string | null;
  publishedAt: string;
  thumbnail: string | null;
  isVideo: boolean;
  mediaType?: string;
  content?: string;
  isCollab?: boolean;
  // métricas de desempenho (só as que a API devolveu; sem invenção)
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
}
// número só quando finito (não inventa 0 quando o campo veio ausente/inválido)
const num = (v: unknown): number | undefined => (Number.isFinite(Number(v)) && v != null ? Number(v) : undefined);
function pickThumb(p: PostAnalyticsItem): string | null {
  const x = p as unknown as Record<string, unknown>;
  const cand = x.thumbnailUrl ?? x.thumbnail ?? x.mediaUrl ?? x.mediaThumbnail ?? x.imageUrl ?? x.pictureUrl;
  // alguns retornos aninham a mídia em mediaItems[0]
  if (typeof cand !== "string") {
    const media = x.mediaItems ?? x.media;
    if (Array.isArray(media) && media.length) {
      const m = media[0] as Record<string, unknown>;
      const mc = m?.thumbnailUrl ?? m?.thumbnail ?? m?.url ?? m?.mediaUrl;
      return typeof mc === "string" ? mc : null;
    }
  }
  return typeof cand === "string" ? cand : null;
}
function toRecent(p: PostAnalyticsItem): RecentPost {
  const x = p as unknown as Record<string, unknown>;
  const mt = String((x.mediaType ?? x.mediaProductType ?? "")).toLowerCase();
  const url = p.platformPostUrl || (typeof x.permalink === "string" ? (x.permalink as string) : null);
  const a = p.analytics || {};
  // colaboração: flag booleana OU lista de colaboradores, se o item trouxer (senão, ignora)
  const collab = x.collaborators;
  const isCollab = x.isCollab === true || (Array.isArray(collab) && collab.length > 0) ? true : undefined;
  return {
    _id: p._id,
    url,
    publishedAt: p.publishedAt,
    thumbnail: pickThumb(p),
    isVideo: mt.includes("video") || mt.includes("reel"),
    mediaType: mt || undefined,
    content: p.content,
    isCollab,
    likes: num(a.likes),
    comments: num(a.comments),
    shares: num(a.shares),
    saves: num(a.saves),
  };
}
function recentPosts(posts: PostAnalyticsItem[], limit = 8): RecentPost[] {
  return [...posts]
    .filter((p) => p.publishedAt)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
    .map(toRecent);
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
  // orgânico vs impulsionado só faz sentido quando HÁ sinal de impulsionamento (post marcado como ad).
  // Sem nenhum ad detectado, NÃO afirmamos "100% orgânico" (a API não separou) → organicShare = null.
  const temSinalPago = paid.count > 0 || paid.reach > 0;
  return { total: posts.length, organic, paid, byType, organicShare: (totReach && temSinalPago) ? organic.reach / totReach : null };
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
    // part=core → só os KPIs (rápido); part=extras → cards pesados; full → tudo (compat/agentes).
    const part = q.get("part") || "full";
    const wantCore = part !== "extras";
    const wantExtras = part !== "core";

    // cache 30s por (workspace + conta + período + parte) — reloads e trocas de card ficam instantâneos
    const payload = await cached(`insights:${ws.id}:${platform}:${accountId}:${since}:${until}:${part}`, 30_000, async () => {
    const isIG = platform === "instagram";
    const hasPosting = platform === "instagram" || platform === "facebook" || platform === "tiktok";
    const hasContent = hasPosting || platform === "youtube" || platform === "linkedin";
    const hasDemo = platform === "instagram" || platform === "youtube";
    const NULL = Promise.resolve(null);

    // ── CORE: métricas dos KPIs + seguidores (poucas chamadas → rápido) ──
    let insights: AnalyticsResponse | null = null, followers: Awaited<ReturnType<typeof followerHistory>> | null = null, keySeries: Awaited<ReturnType<typeof keyMetricSeries>> | null = null;
    if (wantCore) {
      const insightsP: Promise<AnalyticsResponse | null> =
        platform === "youtube"
          ? youtubeChannelInsights(accountId, range).then((r: YoutubeChannelInsights) => toInsights("youtube", accountId, r?.metrics, range)).catch(() => null)
          : platform === "linkedin"
            ? linkedinAggregate(accountId, range).then((r: LinkedinAggregate) => toInsights("linkedin", accountId, r?.analytics, range)).catch(() => null)
            : platform === "threads" ? NULL
              : accountInsightsFull(platform, accountId, range).catch(() => null);
      [insights, followers, keySeries] = await Promise.all([
        insightsP,
        hasPosting ? followerHistory(platform, accountId, range).catch(() => null) : NULL,
        hasPosting ? keyMetricSeries(platform, accountId, range).catch(() => null) : NULL,
      ]);
    }

    // ── EXTRAS: posts/mix/orgânico, últimas, link-taps, stories, best-time, demografia, série diária ──
    let daily = null, postsResp = null, recentResp = null, linkTaps = null, stories: number | null = null, bestSlots = null, demo = null;
    if (wantExtras) {
      [daily, postsResp, recentResp, linkTaps, stories, bestSlots, demo] = await Promise.all([
        hasPosting ? dailyMetrics(accountId, platform, { fromDate: since, toDate: until }).catch(() => null) : NULL,
        hasContent ? postAnalytics({ accountId, platform, fromDate: since, toDate: until, sortBy: "engagement", limit: 100 }).catch(() => null) : NULL,
        hasContent ? postAnalytics({ accountId, platform, sortBy: "publishedAt", order: "desc", limit: 24 }).catch(() => null) : NULL,
        isIG ? profileLinkTaps(accountId, range).catch(() => null) : NULL,
        isIG ? listStories(accountId).then((s) => s.length).catch(() => null) : NULL,
        hasPosting ? bestTime(accountId, platform, (() => {
          const to = until || new Date().toISOString().slice(0, 10);
          const from = new Date(new Date(to + "T00:00:00").getTime() - 90 * 864e5).toISOString().slice(0, 10);
          return { fromDate: from, toDate: to };
        })()).catch(() => null) : NULL,
        hasDemo ? demographics(accountId, { platform }).catch(() => null) : NULL,
      ]);
    }

    const posts = postsResp?.posts || [];
    const top = postsResp ? { overview: postsResp.overview, posts: posts.slice(0, 8) } : null;
    const content = postsResp ? contentSummary(posts) : null;
    const recentSrc = recentResp?.posts?.length ? recentResp.posts : posts;
    const recent = recentSrc.length ? recentPosts(recentSrc, 9) : null;

    return { insights, followers, keySeries, daily, top, content, recent, linkTaps, stories, bestTime: bestSlots, demographics: demo };
    });

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
