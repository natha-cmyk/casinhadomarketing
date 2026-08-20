// Micro-cache TTL em memória (por instância serverless). Colapsa requests repetidos das
// rotas de analytics (mesmo workspace + período) dentro da janela TTL. Some no cold start.
type Entry = { at: number; v: unknown };
const store = new Map<string, Entry>();

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
