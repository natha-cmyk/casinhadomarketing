// Client server-side da Zernio (REST puro — não há SDK Node). Base + auth via env.
// NUNCA importar isto em componente client: a chave é secreta.
// Docs: https://docs.zernio.com/  ·  base https://zernio.com/api/v1
const BASE = "https://zernio.com/api/v1";

function apiKey(): string {
  const k = process.env.ZERNIO_API_KEY;
  if (!k) throw new Error("ZERNIO_API_KEY ausente no ambiente");
  return k;
}

// timeout por chamada: upstream travado falha rápido em vez de segurar a função serverless
// até a Vercel derrubar (o que zerava TODAS as métricas do painel de uma vez).
const ZERNIO_TIMEOUT_MS = 20_000;

async function zernio<T>(path: string, init?: RequestInit): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ZERNIO_TIMEOUT_MS);
  try {
    const res = await fetch(BASE + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Zernio ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error(`Zernio timeout apos ${ZERNIO_TIMEOUT_MS}ms: ${path}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
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
  // tiktok: contadores lifetime (verificado ao vivo) — sem série
  tiktok: ["follower_count", "following_count", "likes_count", "video_count", "followers_gained", "followers_lost"],
  youtube: ["views", "likes", "comments", "shares", "subscribers_gained", "subscribers_lost", "watch_time", "average_view_duration"],
  linkedin: ["impressions", "clicks", "likes", "comments", "shares", "engagement", "unique_impressions"],
  twitter: ["impressions", "likes", "replies", "reposts", "profile_visits", "engagements"],
};

export function accountInsights(
  platform: string,
  accountId: string,
  opts?: { metrics?: string; since?: string; until?: string; metricType?: "total_value" | "time_series" }
) {
  const q = new URLSearchParams({ accountId });
  if (opts?.metrics) q.set("metrics", opts.metrics);
  if (opts?.since) q.set("since", opts.since);
  if (opts?.until) q.set("until", opts.until);
  if (opts?.metricType) q.set("metricType", opts.metricType);
  return zernio<AnalyticsResponse>(`/analytics/${encodeURIComponent(platform)}/account-insights?${q.toString()}`);
}

// métricas que suportam série diária (time_series) por plataforma — o resto é total-only
const TIMESERIES_METRIC: Record<string, string> = {
  instagram: "reach", facebook: "reach", tiktok: "views", youtube: "views", linkedin: "impressions", twitter: "impressions",
};
// série diária da métrica-chave da plataforma (pro gráfico que muda por período)
export async function keyMetricSeries(platform: string, accountId: string, opts?: { since?: string; until?: string }) {
  const metric = TIMESERIES_METRIC[platform];
  if (!metric) return null;
  try {
    const r = await accountInsights(platform, accountId, { ...opts, metrics: metric, metricType: "time_series" });
    const m = r.metrics?.[metric];
    return m?.values?.length ? { metric, label: metric, values: m.values, total: m.total } : null;
  } catch {
    return null;
  }
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

// Google Ads: passthrough de GAQL. GET /ads/insights?accountId=<zernio googleads>&objectId=<customerId>&query=<GAQL>
// A resposta é o passthrough do Google (results/rows) — o parsing é defensivo na rota.
export function googleAdsInsights(accountId: string, objectId: string, query: string) {
  const q = new URLSearchParams({ accountId, objectId, query });
  return zernio<Record<string, unknown>>(`/ads/insights?${q.toString()}`);
}

// ── YouTube (canal) ────────────────────────────────────────────
// channel-insights: totais de views / tempo de exibição / inscritos (SEM série diária de canal).
// A API limita o intervalo a 88 dias — clampamos o `since` pra caber.
export interface YoutubeChannelInsights {
  success?: boolean; accountId: string; platform: string;
  dateRange?: { since: string; until: string };
  metrics: Record<string, { total: number }>;
  dataDelay?: string;
}
function clampSince(since?: string, until?: string, maxDays = 88): string | undefined {
  if (!since || !until) return since;
  const s = new Date(since).getTime(), u = new Date(until).getTime();
  if (!isFinite(s) || !isFinite(u) || u - s <= maxDays * 864e5) return since;
  const ns = new Date(u - maxDays * 864e5), p = (n: number) => String(n).padStart(2, "0");
  return `${ns.getUTCFullYear()}-${p(ns.getUTCMonth() + 1)}-${p(ns.getUTCDate())}`;
}
export function youtubeChannelInsights(accountId: string, opts?: { since?: string; until?: string }) {
  const since = clampSince(opts?.since, opts?.until, 88);
  const q = new URLSearchParams({ accountId });
  if (since) q.set("since", since);
  if (opts?.until) q.set("until", opts.until);
  return zernio<YoutubeChannelInsights>(`/analytics/youtube/channel-insights?${q.toString()}`);
}
// daily-views: a API expõe série de views por VÍDEO (requer videoId) — NÃO há série diária de
// canal. Sem videoId, não existe série (retorna null; o painel esconde "Desempenho no tempo").
export async function youtubeDailyViews(accountId: string, opts?: { since?: string; until?: string; videoId?: string }) {
  if (!opts?.videoId) return null;
  const since = clampSince(opts.since, opts.until, 88);
  const q = new URLSearchParams({ accountId, videoId: opts.videoId });
  if (since) q.set("since", since);
  if (opts.until) q.set("until", opts.until);
  try {
    return await zernio<{ values?: { date: string; value: number }[] }>(`/analytics/youtube/daily-views?${q.toString()}`);
  } catch { return null; }
}

// ── LinkedIn ────────────────────────────────────────────────────
// Conta PESSOAL: só há analytics AGREGADO (lifetime), via este endpoint. account-insights não
// responde JSON pra conta pessoal. Conta de empresa usaria /analytics/linkedin/org-aggregate-analytics.
export interface LinkedinAggregate {
  accountId: string; platform: string; accountType?: string; username?: string;
  aggregation?: string; dateRange?: unknown;
  analytics: Record<string, number>;
  note?: string; lastUpdated?: string;
}
export function linkedinAggregate(accountId: string, opts?: { since?: string; until?: string }) {
  const q = new URLSearchParams();
  if (opts?.since) q.set("since", opts.since);
  if (opts?.until) q.set("until", opts.until);
  const qs = q.toString();
  return zernio<LinkedinAggregate>(`/accounts/${encodeURIComponent(accountId)}/linkedin-aggregate-analytics${qs ? "?" + qs : ""}`);
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
// platform: instagram (default) ou youtube — ambos devolvem { demographics:{age,gender,country,city?} }.
// youtube NÃO usa o param `metric` (age/gender = % de espectadores; country = views).
export function demographics(accountId: string, opts?: { metric?: string; breakdown?: string; platform?: string }) {
  const plat = opts?.platform === "youtube" ? "youtube" : "instagram";
  const q = new URLSearchParams({ accountId });
  if (plat === "instagram") q.set("metric", opts?.metric || "follower_demographics");
  if (opts?.breakdown) q.set("breakdown", opts.breakdown);
  return zernio<DemographicsResponse>(`/analytics/${plat}/demographics?${q.toString()}`);
}

// ── Métricas diárias agregadas (derivadas dos posts) — série uniforme por plataforma ──
// GET /analytics/daily-metrics?accountId=&platform=&fromDate=&toDate= (máx ~90-366 dias)
export interface DailyMetricRow {
  date: string; postCount: number;
  metrics: { impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; views: number };
}
export async function dailyMetrics(accountId: string, platform: string, opts?: { fromDate?: string; toDate?: string }) {
  const q = new URLSearchParams({ accountId, platform });
  if (opts?.fromDate) q.set("fromDate", opts.fromDate);
  if (opts?.toDate) q.set("toDate", opts.toDate);
  const r = await zernio<{ dailyData: DailyMetricRow[] }>(`/analytics/daily-metrics?${q.toString()}`);
  return r.dailyData || [];
}

// ── Analytics por POST (posting analytics) + top conteúdos ──
// GET /analytics?accountId=&platform=&fromDate=&toDate=&sortBy=&limit=&order=
export interface PostAnalyticsItem {
  _id: string; content: string; publishedAt: string; platform: string; platformPostUrl?: string;
  analytics: {
    impressions?: number; reach?: number; likes?: number; comments?: number; shares?: number;
    saves?: number; clicks?: number; views?: number; follows?: number; engagementRate?: number;
    igReelsAvgWatchTime?: number; videoDurationSeconds?: number;
  };
}
export interface PostAnalyticsResp {
  overview: { totalPosts: number; publishedPosts: number; scheduledPosts: number; lastSync?: string };
  posts: PostAnalyticsItem[];
}
export function postAnalytics(opts: { accountId?: string; platform?: string; fromDate?: string; toDate?: string; sortBy?: string; order?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (opts.accountId) q.set("accountId", opts.accountId);
  if (opts.platform) q.set("platform", opts.platform);
  if (opts.fromDate) q.set("fromDate", opts.fromDate);
  if (opts.toDate) q.set("toDate", opts.toDate);
  q.set("sortBy", opts.sortBy || "engagement");
  q.set("order", opts.order || "desc");
  q.set("limit", String(opts.limit ?? 10));
  return zernio<PostAnalyticsResp>(`/analytics?${q.toString()}`);
}

// ── Melhores horários (best-time): engajamento médio por dia da semana × hora ──
export interface BestTimeSlot { day_of_week: number; hour: number; avg_engagement: number; post_count: number }
export async function bestTime(accountId: string, platform: string, opts?: { fromDate?: string; toDate?: string }): Promise<BestTimeSlot[]> {
  const q = new URLSearchParams({ accountId, platform });
  if (opts?.fromDate) q.set("fromDate", opts.fromDate);
  if (opts?.toDate) q.set("toDate", opts.toDate);
  const r = await zernio<{ slots: BestTimeSlot[] }>(`/analytics/best-time?${q.toString()}`);
  return r.slots || [];
}

// ── Toques em links do perfil por TIPO (WEBSITE/CALL/EMAIL/TEXT/DIRECTION) — IG ──
export async function profileLinkTaps(accountId: string, opts?: { since?: string; until?: string }): Promise<Record<string, number>> {
  const q = new URLSearchParams({ accountId, metrics: "profile_links_taps", breakdown: "contact_button_type" });
  if (opts?.since) q.set("since", opts.since);
  if (opts?.until) q.set("until", opts.until);
  const r = await zernio<AnalyticsResponse & { metrics: Record<string, { total: number; breakdowns?: { dimension: string; value: number }[] }> }>(
    `/analytics/instagram/account-insights?${q.toString()}`
  );
  const out: Record<string, number> = {};
  for (const b of r.metrics?.profile_links_taps?.breakdowns || []) out[b.dimension] = b.value;
  return out;
}

// ── Stories ativos (IG, efêmeros — últimas ~24h) ──
export interface StoryItem { id: string; mediaType?: string; mediaProductType?: string; permalink?: string }
export async function listStories(accountId: string): Promise<StoryItem[]> {
  const r = await zernio<{ data: StoryItem[] }>(`/accounts/${encodeURIComponent(accountId)}/instagram/stories`);
  return r.data || [];
}

// ── Inbox analytics (conversas/DMs) ──
export interface InboxVolume {
  success: boolean; from: string; to: string;
  summary: { received: number; sent: number; read: number; failed: number; uniqueConversations: number };
  timeseries: { date: string; sent: number; received: number; read: number; failed: number }[];
  byPlatform: { platform: string; sent: number; received: number }[];
}
export interface InboxResponseTime {
  success: boolean;
  summary: { sampleSize: number; medianSeconds: number; p90Seconds: number; meanSeconds: number; fastestSeconds: number; slowestSeconds: number };
  histogram: { bucket: string; count: number }[];
}
export interface InboxSourceBreakdown {
  success: boolean;
  sources: { source: string; received: number; sent: number; read: number }[];
}
function inboxQS(opts?: { fromDate?: string; toDate?: string; accountId?: string; platform?: string }) {
  const q = new URLSearchParams();
  if (opts?.fromDate) q.set("fromDate", opts.fromDate);
  if (opts?.toDate) q.set("toDate", opts.toDate);
  if (opts?.accountId) q.set("accountId", opts.accountId);
  if (opts?.platform) q.set("platform", opts.platform);
  return q.toString();
}
export const inboxVolume = (o?: Parameters<typeof inboxQS>[0]) => zernio<InboxVolume>(`/analytics/inbox/volume?${inboxQS(o)}`);
export const inboxResponseTime = (o?: Parameters<typeof inboxQS>[0]) => zernio<InboxResponseTime>(`/analytics/inbox/response-time?${inboxQS(o)}`);
export const inboxSourceBreakdown = (o?: Parameters<typeof inboxQS>[0]) => zernio<InboxSourceBreakdown>(`/analytics/inbox/source-breakdown?${inboxQS(o)}`);

// ── Publicação / agendamento (POST /posts) ─────────────────────────────────
// Contrato CONFIRMADO ao vivo (OpenAPI Zernio 1.0.4). Body:
//   { title?, content?, mediaItems?,
//     platforms: [{ platform, accountId, customContent?, scheduledFor? }],  // required p/ não-draft
//     scheduledFor? (ISO date-time), publishNow? (bool, default false), isDraft? (bool),
//     timezone? (default "UTC"), tags?, hashtags? }
// Sem scheduledFor/publishNow/isDraft o post vira DRAFT automaticamente.
// Retorno 201: { post: { _id, status, scheduledFor?, publishedAt?, platforms:[{platform,status,platformPostUrl?}] }, message }.
//   status: draft | scheduled | published | failed.
// Dedup por conteúdo (24h) devolve 409; falta de permissão da conta → 4xx/5xx com corpo.
export interface ZernioPostPlatform {
  platform: string;
  accountId: string;
  customContent?: string;
  scheduledFor?: string;
  platformSpecificData?: Record<string, unknown>;
}
export interface ZernioPublishInput {
  content?: string;
  title?: string;
  platforms: ZernioPostPlatform[];
  scheduledFor?: string;
  publishNow?: boolean;
  isDraft?: boolean;
  timezone?: string;
  tags?: string[];
  hashtags?: string[];
  mediaItems?: unknown[];
}
export interface ZernioPost {
  _id: string;
  status: string; // draft | scheduled | published | failed
  scheduledFor?: string;
  publishedAt?: string;
  platforms?: { platform: string; status?: string; platformPostUrl?: string }[];
  [k: string]: unknown;
}
// Cria/agenda/publica um post. Uma chamada cobre N plataformas.
export function publishPost(input: ZernioPublishInput) {
  return zernio<{ post: ZernioPost; message?: string; existingPost?: ZernioPost }>("/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ── Mídia (presign) ────────────────────────────────────────────────────────
// POST /media/presign → { uploadUrl, publicUrl, key, expiresIn }. Faz-se PUT do arquivo
// DIRETO no uploadUrl (cloud storage, expira 1h, até 5GB) e usa-se publicUrl em mediaItems.
export interface PresignInput { filename: string; contentType: string; size?: number }
export interface PresignResp { uploadUrl: string; publicUrl: string; key: string; expiresIn: number }
export function presignMedia(input: PresignInput) {
  return zernio<PresignResp>("/media/presign", { method: "POST", body: JSON.stringify(input) });
}
export interface MediaItemInput { type: "image" | "video" | "gif" | "document"; url: string; filename?: string; mimeType?: string; size?: number; altText?: string }

// GET /posts — lista posts (default: agendados) do profile, p/ reconciliar a fila local com a Zernio.
export interface ZernioListedPost extends ZernioPost {
  title?: string;
  content?: string;
  timezone?: string;
}
export async function getScheduledPosts(opts?: { profileId?: string; status?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (opts?.profileId) q.set("profileId", opts.profileId);
  q.set("status", opts?.status || "scheduled"); // draft | scheduled | published | failed
  q.set("limit", String(opts?.limit ?? 100));
  const r = await zernio<{ posts: ZernioListedPost[]; pagination?: unknown }>(`/posts?${q.toString()}`);
  return r.posts || [];
}

// ── Google Business (Perfil da Empresa / GBP) ───────────────────────────────
// Verificado ao vivo (conta Seahub). A conta googlebusiness da Zernio representa UMA
// localização SELECIONADA (metadata.selectedLocationId). Todos os endpoints de leitura
// (performance/keywords/media/reviews/details) refletem ESSA localização — o param
// `locationId` em performance é IGNORADO pela API (as 3 fichas devolvem números idênticos).
// Trocar a ficha ativa exige POST /accounts/{id}/gmb-locations/assign (escrita) — não fazemos.
export interface GbpMetric { total: number; values: { date: string; value: number }[] }
export interface GbpPerformance {
  success: boolean; accountId: string; platform: string;
  dateRange?: { since?: string; until?: string; fromDate?: string; toDate?: string };
  dataDelay?: string;
  // métricas reais (Seahub): BUSINESS_IMPRESSIONS_{DESKTOP,MOBILE}_{SEARCH,MAPS},
  // BUSINESS_DIRECTION_REQUESTS, CALL_CLICKS, WEBSITE_CLICKS, BUSINESS_CONVERSATIONS,
  // BUSINESS_BOOKINGS, BUSINESS_FOOD_ORDERS, BUSINESS_FOOD_MENU_CLICKS
  metrics: Record<string, GbpMetric>;
}
export interface GbpKeyword { keyword: string; impressions: number }
export interface GbpKeywordsResp {
  success: boolean; accountId: string; platform: string;
  monthRange?: { startMonth: string; endMonth: string };
  keywords: GbpKeyword[];
}
export interface GbpLocation {
  id: string; name: string; accountId?: string; accountName?: string;
  address?: string; category?: string; websiteUrl?: string; storeCode?: string;
}
export interface GbpLocationsResp { locations: GbpLocation[] }
export interface GbpMediaItem {
  name: string; sourceUrl?: string; mediaFormat?: string;
  googleUrl?: string; thumbnailUrl?: string; createTime?: string;
  locationAssociation?: { category?: string };
  dimensions?: { widthPixels?: number; heightPixels?: number };
}
export interface GbpMediaResp { success: boolean; accountId: string; locationId?: string; mediaItems: GbpMediaItem[] }
export interface GbpReview {
  id: string; name?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  rating?: number; starRating?: string; comment?: string;
  createTime?: string; updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string } | null;
  photoCount?: number;
}
export interface GbpReviewsResp {
  success: boolean; accountId: string; locationId?: string;
  reviews: GbpReview[]; averageRating?: number; totalReviewCount?: number; nextPageToken?: string;
}
export interface GbpDetails {
  success: boolean; accountId: string; locationId?: string;
  location?: { name?: string; placeId?: string; reviewUrl?: string; mapsUri?: string; isVerified?: boolean };
  title?: string;
  phoneNumbers?: { primaryPhone?: string };
  categories?: { primaryCategory?: { displayName?: string } };
  [k: string]: unknown;
}

function gbpDateQS(accountId: string, opts?: { fromDate?: string; toDate?: string; locationId?: string }) {
  const q = new URLSearchParams({ accountId });
  if (opts?.fromDate) q.set("fromDate", opts.fromDate);
  if (opts?.toDate) q.set("toDate", opts.toDate);
  if (opts?.locationId) q.set("locationId", opts.locationId); // enviado por completude; a API ignora
  return q.toString();
}

// GET /analytics/googlebusiness/performance — impressões (busca/maps × mobile/desktop),
// pedidos de rota, cliques (site/ligar), conversas, agendamentos. Série diária por métrica.
export function gbpPerformance(accountId: string, opts?: { fromDate?: string; toDate?: string; locationId?: string }) {
  return zernio<GbpPerformance>(`/analytics/googlebusiness/performance?${gbpDateQS(accountId, opts)}`);
}
// GET /analytics/googlebusiness/search-keywords — termos que trouxeram a ficha (por mês, últimos ~3).
export function gbpSearchKeywords(accountId: string, opts?: { fromDate?: string; toDate?: string }) {
  return zernio<GbpKeywordsResp>(`/analytics/googlebusiness/search-keywords?${gbpDateQS(accountId, opts)}`);
}
// GET /accounts/{id}/gmb-locations — TODAS as fichas (localizações) do perfil conectado.
export function gbpLocations(accountId: string) {
  return zernio<GbpLocationsResp>(`/accounts/${encodeURIComponent(accountId)}/gmb-locations`);
}
// GET /accounts/{id}/gmb-media — fotos da ficha ativa.
export function gbpMedia(accountId: string) {
  return zernio<GbpMediaResp>(`/accounts/${encodeURIComponent(accountId)}/gmb-media`);
}
// GET /accounts/{id}/gmb-reviews — avaliações + média + total (da ficha ativa).
export function gbpReviews(accountId: string) {
  return zernio<GbpReviewsResp>(`/accounts/${encodeURIComponent(accountId)}/gmb-reviews`);
}
// GET /accounts/{id}/gmb-location-details — telefone, categoria, verificação, link do Maps (ficha ativa).
export function gbpLocationDetails(accountId: string) {
  return zernio<GbpDetails>(`/accounts/${encodeURIComponent(accountId)}/gmb-location-details`);
}

// ── Google Business — ESCRITA (contratos confirmados ao vivo) ────────────────
// PUT /accounts/{id}/gmb-locations  body { selectedLocationId } — troca qual ficha o Zernio
// SINCRONIZA. Como o param `locationId` nos GETs de analytics é ignorado (a Zernio só serve os
// dados da ficha SELECIONADA), ver métricas de outra ficha exige trocar a selecionada aqui e
// re-buscar os endpoints de leitura.
export interface GbpSetLocationResp {
  success?: boolean;
  selectedLocationId?: string;
  message?: string;
  [k: string]: unknown;
}
export function gbpSetLocation(accountId: string, selectedLocationId: string) {
  return zernio<GbpSetLocationResp>(`/accounts/${encodeURIComponent(accountId)}/gmb-locations`, {
    method: "PUT",
    body: JSON.stringify({ selectedLocationId }),
  });
}

// POST /accounts/{id}/gmb-reviews/{reviewId}/reply  body { comment } (min 1 char) — publica a
// resposta do dono a uma avaliação. A resposta fica associada à ficha SELECIONADA no momento.
// Chamar de novo sobrescreve (PUT semantics do Google). `reviewId` = a parte curta (não o
// resource name completo).
export interface GbpReplyResp {
  success?: boolean;
  reviewId?: string;
  platform?: string;
  [k: string]: unknown;
}
export function gbpReplyReview(accountId: string, reviewId: string, comment: string) {
  return zernio<GbpReplyResp>(
    `/accounts/${encodeURIComponent(accountId)}/gmb-reviews/${encodeURIComponent(reviewId)}/reply`,
    { method: "POST", body: JSON.stringify({ comment }) }
  );
}
