// Client server-side da Zernio (REST puro — não há SDK Node). Base + auth via env.
// NUNCA importar isto em componente client: a chave é secreta.
// Docs: https://docs.zernio.com/  ·  base https://zernio.com/api/v1
const BASE = "https://zernio.com/api/v1";

function apiKey(): string {
  const k = process.env.ZERNIO_API_KEY;
  if (!k) throw new Error("ZERNIO_API_KEY ausente no ambiente");
  return k;
}

async function zernio<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zernio ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface ZernioAccount {
  _id: string;
  platform: string;
  profileId?: { _id: string; name?: string } | string;
  followersCount?: number;
  displayName?: string;
  [k: string]: unknown;
}

// GET /accounts — contas conectadas (opcionalmente filtradas por profile)
export async function listAccounts(profileId?: string) {
  const qs = profileId ? `?profileId=${encodeURIComponent(profileId)}` : "";
  const data = await zernio<{ accounts: ZernioAccount[] }>(`/accounts${qs}`);
  // filtro defensivo por profile (caso a API não filtre no server)
  if (profileId) {
    data.accounts = data.accounts.filter((a) => {
      const p = a.profileId;
      const id = typeof p === "string" ? p : p?._id;
      return !id || id === profileId;
    });
  }
  return data;
}

// POST /profiles — cria um profile (1 por workspace). Retorna profile._id
export function createProfile(name: string, description?: string) {
  return zernio<{ message: string; profile: { _id: string; name: string } }>("/profiles", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

// GET /connect/{platform}?profileId=&redirect_url= — OAuth hospedado.
// redirect_url = pra onde a Zernio volta DEPOIS do OAuth (nossa plataforma, não o dashboard dela).
export function connectUrl(platform: string, profileId?: string, redirectUrl?: string) {
  const pid = profileId ?? process.env.ZERNIO_PROFILE_ID;
  const q = new URLSearchParams();
  if (pid) q.set("profileId", pid);
  if (redirectUrl) q.set("redirect_url", redirectUrl);
  return zernio<{ authUrl: string }>(`/connect/${encodeURIComponent(platform)}?${q.toString()}`);
}

// GET /connect/{platform}/ads?profileId=&redirect_url= — conecta conta de anúncio.
// same-token (facebook/instagram/linkedin/pinterest) copia o token do posting; googleads standalone.
export function connectAdsUrl(platform: string, profileId?: string, redirectUrl?: string) {
  const pid = profileId ?? process.env.ZERNIO_PROFILE_ID;
  const q = new URLSearchParams();
  if (pid) q.set("profileId", pid);
  if (redirectUrl) q.set("redirect_url", redirectUrl);
  return zernio<{ authUrl?: string; alreadyConnected?: boolean }>(`/connect/${encodeURIComponent(platform)}/ads?${q.toString()}`);
}

// GET /analytics/{platform}/account-insights — séries por conta (máx 90 dias)
export interface AnalyticsMetric {
  total: number;
  values: { date: string; value: number }[];
  unit?: string;
  currency?: string;
}
export interface AnalyticsResponse {
  success: boolean;
  accountId: string;
  platform: string;
  dateRange: { since: string; until: string };
  metricType: string;
  metrics: Record<string, AnalyticsMetric>;
  unavailableMetrics?: string[];
}
// conjunto COMPLETO de métricas por plataforma (a API só devolve ~4 por padrão).
// instagram verificado ao vivo; demais são o superset conhecido — a chamada tem
// fallback (accountInsightsFull) que degrada pro default se a lista tiver métrica inválida.
export const ACCOUNT_METRICS: Record<string, string[]> = {
  instagram: ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments",
    "shares", "saves", "replies", "reposts", "follows_and_unfollows", "profile_links_taps"],
  facebook: ["reach", "views", "total_interactions", "likes", "comments", "shares", "post_engagements"],
  tiktok: ["views", "likes", "comments", "shares", "reach", "engaged_audience", "profile_views"],
  youtube: ["views", "likes", "comments", "shares", "subscribers_gained", "subscribers_lost", "watch_time", "average_view_duration"],
  linkedin: ["impressions", "clicks", "likes", "comments", "shares", "engagement", "unique_impressions"],
  twitter: ["impressions", "likes", "replies", "reposts", "profile_visits", "engagements"],
};

export function accountInsights(
  platform: string,
  accountId: string,
  opts?: { metrics?: string; since?: string; until?: string }
) {
  const q = new URLSearchParams({ accountId });
  if (opts?.metrics) q.set("metrics", opts.metrics);
  if (opts?.since) q.set("since", opts.since);
  if (opts?.until) q.set("until", opts.until);
  return zernio<AnalyticsResponse>(`/analytics/${encodeURIComponent(platform)}/account-insights?${q.toString()}`);
}

// puxa o conjunto completo de métricas conhecidas; se a lista rejeitar (métrica inválida
// numa plataforma não-verificada), refaz sem `metrics` pra pegar ao menos os defaults.
export async function accountInsightsFull(
  platform: string,
  accountId: string,
  opts?: { since?: string; until?: string }
): Promise<AnalyticsResponse> {
  const full = ACCOUNT_METRICS[platform];
  if (full) {
    try {
      return await accountInsights(platform, accountId, { ...opts, metrics: full.join(",") });
    } catch {
      // fallback pros defaults da plataforma
    }
  }
  return accountInsights(platform, accountId, opts);
}

// ── ADS (Meta/Facebook por ora) ────────────────────────────────
export interface AdAccount {
  id: string; name: string; currency: string;
  accountStatus?: number; businessName?: string; selectable?: boolean;
}
// GET /ads/accounts?accountId=<zernioAccountId> — ad accounts (act_...) da conta conectada
export function listAdAccounts(accountId: string) {
  return zernio<{ accounts: AdAccount[] }>(`/ads/accounts?accountId=${encodeURIComponent(accountId)}`);
}

export interface AdInsightRow {
  campaign_name?: string; account_id?: string;
  impressions?: string; spend?: string; clicks?: string; reach?: string;
  ctr?: string; cpc?: string; cpm?: string; frequency?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
  date_start?: string; date_stop?: string;
  [k: string]: unknown;
}
const AD_FIELDS = "impressions,spend,clicks,ctr,cpc,cpm,reach,frequency,inline_link_clicks,actions";
// GET /ads/insights?accountId=<zernio>&objectId=<act_>&level=&fields= — desempenho de mídia paga
export function adsInsights(
  accountId: string,
  objectId: string,
  opts?: { since?: string; until?: string; level?: "account" | "campaign" | "adset" | "ad"; fields?: string }
) {
  const q = new URLSearchParams({ accountId, objectId, fields: opts?.fields ?? AD_FIELDS });
  if (opts?.since) q.set("since", opts.since);
  if (opts?.until) q.set("until", opts.until);
  if (opts?.level) q.set("level", opts.level);
  return zernio<{ objectId: string; data: AdInsightRow[]; paging?: unknown }>(`/ads/insights?${q.toString()}`);
}

// GET /analytics/{platform}/follower-history — série diária de seguidores (mesmo envelope)
export function followerHistory(platform: string, accountId: string, opts?: { since?: string; until?: string }) {
  const q = new URLSearchParams({ accountId });
  if (opts?.since) q.set("since", opts.since);
  if (opts?.until) q.set("until", opts.until);
  return zernio<AnalyticsResponse>(`/analytics/${encodeURIComponent(platform)}/follower-history?${q.toString()}`);
}

// GET /analytics/instagram/demographics — audiência por idade/cidade/país/gênero (top 45)
export interface DemographicsResponse {
  success: boolean;
  accountId: string;
  platform: string;
  metric: string;
  // shape real da API: demographics.{age,gender,country,city} = [{dimension,value}]
  demographics?: Record<string, { dimension: string; value: number }[]>;
  // fallbacks tolerantes a outras formas
  breakdowns?: Record<string, { dimension: string; value: number }[]>;
  metrics?: Record<string, { breakdowns?: { dimension: string; value: number }[] }>;
  [k: string]: unknown;
}
export function demographics(accountId: string, opts?: { metric?: string; breakdown?: string }) {
  const q = new URLSearchParams({ accountId });
  q.set("metric", opts?.metric || "follower_demographics");
  if (opts?.breakdown) q.set("breakdown", opts.breakdown);
  return zernio<DemographicsResponse>(`/analytics/instagram/demographics?${q.toString()}`);
}

// TODO(zernio): POST /posts (publish do calendário) — {content, scheduledFor, timezone, platforms:[{platform,accountId}]}
