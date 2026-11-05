// Cache PERSISTENTE para períodos FECHADOS (imutáveis) — sobrevive a reinício do servidor.
// Camadas: 1) memória (instantâneo na instância quente) → 2) banco (AnalyticsCache, sobrevive
// cold start) → 3) computa e grava nas duas. Resposta boa de período fechado não expira.
// Resposta vazia ou de erro não é gravada; se uma linha antiga estiver vazia, a próxima leitura boa substitui.
// Use só para dados de fato imutáveis (métricas sociais de período fechado). Dados que ainda podem
// mudar (ex.: desfecho de lead do CRM) NÃO devem usar isto — usar o cached() com TTL.
import { prisma } from "@/lib/prisma";

const MEM_MAX = 500;
const MEM_MAX_CHARS = 750_000;
const mem = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

function readMem<T>(key: string): T | undefined {
  if (!mem.has(key)) return undefined;
  const value = mem.get(key) as T;
  mem.delete(key);
  mem.set(key, value);
  return value;
}

function writeMem(key: string, value: unknown): void {
  let chars = 0;
  try {
    chars = JSON.stringify(value).length;
  } catch {
    return;
  }
  if (chars > MEM_MAX_CHARS) return;
  if (mem.has(key)) mem.delete(key);
  mem.set(key, value);
  while (mem.size > MEM_MAX) {
    const oldest = mem.keys().next().value;
    if (oldest === undefined) break;
    mem.delete(oldest);
  }
}

export function resetAnalyticsCacheForTests(): void {
  mem.clear();
  inflight.clear();
}

/** null e lista vazia não são período fechado — não congelam a primeira falha. */
export function defaultWorthKeeping(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/** Insights: timeout deixa tudo null. Isso não pode virar o mês passado para sempre. */
export function insightsWorthKeeping(payload: {
  insights?: unknown;
  followers?: unknown;
  keySeries?: unknown;
  daily?: unknown;
  top?: unknown;
  recent?: unknown;
  linkTaps?: unknown;
  demographics?: unknown;
  bestTime?: unknown;
  stories?: unknown;
} | null): boolean {
  if (!payload || typeof payload !== "object") return false;
  if (typeof payload.stories === "number") return true;
  return [
    payload.insights,
    payload.followers,
    payload.keySeries,
    payload.daily,
    payload.top,
    payload.recent,
    payload.linkTaps,
    payload.demographics,
    payload.bestTime,
  ].some((v) => v != null);
}

export async function cachedImmutable<T>(
  key: string,
  fn: () => Promise<T>,
  worthKeeping: (value: T) => boolean = defaultWorthKeeping as (value: T) => boolean,
): Promise<T> {
  const hit = readMem<T>(key);
  if (hit !== undefined && worthKeeping(hit)) return hit;
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = load().finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;

  async function load(): Promise<T> {
    // banco (sobrevive a reinício). Payload vazio/erro gravado antes é ignorado e recalculado.
    let hadRow = false;
    try {
      const row = await prisma.analyticsCache.findUnique({ where: { key } });
      if (row) {
        hadRow = true;
        if (row.payload != null && worthKeeping(row.payload as T)) {
          writeMem(key, row.payload);
          return row.payload as T;
        }
      }
    } catch {
      /* sem banco / tabela ainda não migrada: segue pro cálculo */
    }
    const v = await fn();
    if (!worthKeeping(v)) return v;
    writeMem(key, v);
    // Primeira gravação boa fica. Linha antiga vazia/erro é substituída por esta.
    prisma.analyticsCache
      .upsert({
        where: { key },
        create: { key, payload: v as object },
        update: hadRow ? { payload: v as object } : {},
      })
      .catch(() => {});
    return v;
  }
}
