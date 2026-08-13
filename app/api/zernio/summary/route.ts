// GET /api/zernio/summary?since=YYYY-MM-DD&until=YYYY-MM-DD
// Resumo LEVE do painel (overview): 1-2 chamadas por conta conectada, montando os
// indicadores PRIMÁRIOS por plataforma + produção de conteúdo (posts publicados no
// período). Uma conta falhar NÃO derruba as outras.
//   instagram/facebook/tiktok → account-insights (reach/views/total_interactions/…)
//   youtube                   → channel-insights (views/tempo/inscritos ganhos/perdidos)
//   linkedin                  → linkedin-aggregate (impressões/alcance/interações/…)
//   googlebusiness            → gbp-performance (impressões busca+Maps, rotas, cliques)
//   threads/demais            → só followersCount (sem analytics de conta)
//   posts (produção)          → postAnalytics.overview.publishedPosts (só redes com posting)
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import {
  listAccounts, accountInsightsFull, youtubeChannelInsights, linkedinAggregate,
  gbpPerformance, postAnalytics,
  type ZernioAccount,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// achata {k:{total}} | {k:{total,values}} | {k:number} → {k:number}
function flatten(raw?: Record<string, { total?: number } | number> | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    const t = typeof v === "number" ? v : num(v?.total);
    if (t != null && Number.isFinite(t)) out[k] = t;
  }
  return out;
}

// plataformas cujo resumo vem de account-insights (série/total por conta)
const IG_LIKE = new Set(["instagram", "facebook", "tiktok", "twitter"]);
// plataformas de mídia paga: pertencem à visão de Ads, NÃO ao overview de canais
const ADS_ONLY = new Set(["metaads", "googleads", "linkedinads", "tiktokads", "pinterestads", "snapchatads"]);
// plataformas com posting (produção de conteúdo mensurável por publishedPosts)
const POSTING = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin"]);

interface AccountSummary {
  platform: string;
  displayName?: string;
  username?: string;
  followersCount: number | null;
  metrics: Record<string, number>;
  posts: number | null; // posts publicados no período (produção de conteúdo)
}

async function summarize(a: ZernioAccount, range: { since: string; until: string }): Promise<AccountSummary> {
  const platform = String(a.platform);
  const rec = a as Record<string, unknown>;
  const base: AccountSummary = {
    platform,
    displayName: (a.displayName as string | undefined) ?? (rec.name as string | undefined) ?? (rec.username as string | undefined),
    username: rec.username as string | undefined,
    followersCount: num(a.followersCount) ?? null,
    metrics: {},
    posts: null,
  };

  await Promise.all([
    // indicadores primários da plataforma
    (async () => {
      try {
        if (platform === "youtube") {
          const r = await youtubeChannelInsights(a._id, range);
          base.metrics = flatten(r?.metrics);
        } else if (platform === "linkedin") {
          const r = await linkedinAggregate(a._id, range);
          base.metrics = flatten(r?.analytics);
        } else if (platform === "googlebusiness") {
          const r = await gbpPerformance(a._id, { fromDate: range.since, toDate: range.until });
          base.metrics = flatten(r?.metrics);
        } else if (IG_LIKE.has(platform)) {
          const r = await accountInsightsFull(platform, a._id, range);
          base.metrics = flatten(r?.metrics);
        }
        // threads / demais → só followersCount (metrics vazio)
      } catch {
        base.metrics = {};
      }
    })(),
    // produção de conteúdo (posts publicados no período) — só redes com posting
    (async () => {
      if (!POSTING.has(platform)) return;
      try {
        const r = await postAnalytics({ accountId: a._id, platform, fromDate: range.since, toDate: range.until, limit: 1 });
        const pub = num(r?.overview?.publishedPosts);
        if (pub != null) base.posts = pub;
      } catch {
        // produção indisponível não derruba o resumo da conta
      }
    })(),
  ]);

  return base;
}

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws?.zernioProfileId) return NextResponse.json({ accounts: [] });

    const q = new URL(req.url).searchParams;
    const now = new Date();
    const until = q.get("until") || iso(now);
    const since = q.get("since") || iso(new Date(now.getTime() - 30 * 864e5));
    const range = { since, until };

    const { accounts } = await listAccounts(ws.zernioProfileId);
    // conta conectada = social (posting habilitado) OU com analytics própria.
    // ads-only (mídia paga) fica fora do overview de canais — vive na visão de Ads.
    const connected = accounts.filter(
      (a) =>
        !ADS_ONLY.has(String(a.platform)) &&
        (a.enabled === true || (a as Record<string, unknown>).analyticsEnabled === true)
    );

    const summaries = await Promise.all(
      connected.map((a) =>
        summarize(a, range).catch<AccountSummary>(() => ({
          platform: String(a.platform),
          displayName: (a.displayName as string | undefined),
          username: (a as Record<string, unknown>).username as string | undefined,
          followersCount: num(a.followersCount) ?? null,
          metrics: {},
          posts: null,
        }))
      )
    );

    return NextResponse.json({ accounts: summaries });
  } catch (e) {
    // painel degrada para o empty-state em vez de quebrar
    return NextResponse.json({ accounts: [], error: String(e) });
  }
}
