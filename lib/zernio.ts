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

// TODO(zernio): POST /posts (publish do calendário) — {content, scheduledFor, timezone, platforms:[{platform,accountId}]}
