// Micro-cache TTL em memória (por instância serverless). Colapsa requests repetidos das
// rotas de analytics (mesmo workspace + período) dentro da janela TTL. Some no cold start.
export type TtlEntry = { at: number; ttl: number; v: unknown };

const MAX_ENTRIES = 500;
const store = new Map<string, TtlEntry>();
const inflight = new Map<string, Promise<unknown>>();

// Data de HOJE em Natal/RN (America/Fortaleza, UTC−3, sem horário de verão), como "yyyy-mm-dd".
function hojeFortaleza(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
// TTL adaptativo por período: se o período JÁ FECHOU (until estritamente no passado), os dados são
// IMUTÁVEIS → cacheia por muito tempo (default 6h). Período que inclui hoje/futuro segue vivo → TTL curto.
// Ex.: agosto num setembro carrega uma vez e fica instantâneo; o mês corrente continua atualizando.
export function periodTtl(until: string | null | undefined, liveMs: number, closedMs = 6 * 60 * 60_000): number {
  if (!until) return liveMs;
  return until < hojeFortaleza() ? closedMs : liveMs;
}
// true quando o período JÁ FECHOU (until estritamente no passado, fuso Natal/RN) → dados imutáveis.
export function periodClosed(until: string | null | undefined): boolean {
  return !!until && until < hojeFortaleza();
}

// Remove expirados pelo TTL de cada entrada (não pelo TTL de quem chamou) e, se ainda
// passar do teto, as mais antigas. A leitura continua usando o TTL do chamador.
export function pruneTtlStore(target: Map<string, TtlEntry>, maxEntries: number, now = Date.now()): void {
  if (target.size <= maxEntries) return;
  for (const [k, e] of target) {
    if (now - e.at >= e.ttl) target.delete(k);
  }
  while (target.size > maxEntries) {
    const oldest = target.keys().next().value;
    if (oldest === undefined) break;
    target.delete(oldest);
  }
}

// invalida entradas cujo key começa com `prefix` (ex.: após gravar célula manual da planilha).
// Também solta o in-flight: o resultado que ainda vai chegar não regrava dado velho por cima.
export function bust(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
  for (const k of inflight.keys()) if (k.startsWith(prefix)) inflight.delete(k);
}

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = fn()
    .then((v) => {
      if (inflight.get(key) === p) {
        store.set(key, { at: Date.now(), ttl: ttlMs, v });
        pruneTtlStore(store, MAX_ENTRIES);
      }
      return v;
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function resetTtlCacheForTests(): void {
  store.clear();
  inflight.clear();
}
