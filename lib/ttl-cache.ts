// Micro-cache TTL em memória (por instância serverless). Colapsa requests repetidos das
// rotas de analytics (mesmo workspace + período) dentro da janela TTL. Some no cold start.
type Entry = { at: number; v: unknown };
const store = new Map<string, Entry>();

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

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  store.set(key, { at: Date.now(), v });
  // limpeza preguiçosa: se crescer muito, remove os mais velhos
  if (store.size > 500) {
    const cutoff = Date.now() - ttlMs;
    for (const [k, e] of store) if (e.at < cutoff) store.delete(k);
  }
  return v;
}
