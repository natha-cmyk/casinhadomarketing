// Cache de módulo no browser (stale-while-revalidate). A chave inclui o workspace
// e o logout zera os mapas: trocar de conta na mesma aba não reaproveita o dado anterior.

type Bucket = { clear(): void };

const buckets: Bucket[] = [];
let scope = "";

export function clientCacheScope(): string {
  return scope;
}

export function setClientCacheScope(workspaceId: string): void {
  const next = workspaceId.trim();
  if (!next || next === scope) return;
  for (const bucket of buckets) bucket.clear();
  scope = next;
}

export function clearClientCaches(): void {
  for (const bucket of buckets) bucket.clear();
  scope = "";
}

export interface ScopedCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  delete(key: string): void;
}

export function scopedCache<T>(): ScopedCache<T> {
  const map = new Map<string, T>();
  buckets.push({ clear: () => map.clear() });
  const id = (key: string) => `${scope}\n${key}`;
  return {
    get(key) {
      if (!scope) return undefined;
      return map.get(id(key));
    },
    set(key, value) {
      if (!scope) return;
      map.set(id(key), value);
    },
    delete(key) {
      if (!scope) return;
      map.delete(id(key));
    },
  };
}
