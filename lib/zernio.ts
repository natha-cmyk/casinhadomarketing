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
}

// GET /accounts — contas conectadas ao profile da chave
export function listAccounts() {
  return zernio<{ accounts: ZernioAccount[] }>("/accounts");
}

// GET /connect/{platform}?profileId= — URL de OAuth hospedado p/ conectar conta
export function connectUrl(platform: string, profileId?: string) {
  const pid = profileId ?? process.env.ZERNIO_PROFILE_ID;
  const qs = pid ? `?profileId=${encodeURIComponent(pid)}` : "";
  return zernio<{ authUrl: string }>(`/connect/${encodeURIComponent(platform)}${qs}`);
}

// TODO(zernio): GET /analytics (ligar nos painéis) e POST /posts (publish do calendário)
// — confirmar shape de resposta do /analytics antes de mapear.
