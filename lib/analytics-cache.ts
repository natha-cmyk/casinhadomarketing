// Cache PERSISTENTE para períodos FECHADOS (imutáveis) — sobrevive a reinício do servidor.
// Camadas: 1) memória (instantâneo na instância quente) → 2) banco (AnalyticsCache, sobrevive
// cold start) → 3) computa e grava nas duas. NÃO expira: mês/semana passados não mudam.
// Use só para dados de fato imutáveis (métricas sociais de período fechado). Dados que ainda podem
// mudar (ex.: desfecho de lead do CRM) NÃO devem usar isto — usar o cached() com TTL.
import { prisma } from "@/lib/prisma";

const mem = new Map<string, unknown>();

export async function cachedImmutable<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = mem.get(key);
  if (hit !== undefined) return hit as T;
  // banco (sobrevive a reinício)
  try {
    const row = await prisma.analyticsCache.findUnique({ where: { key } });
    if (row && row.payload != null) {
      mem.set(key, row.payload);
      return row.payload as T;
    }
  } catch {
    /* sem banco / tabela ainda não migrada: segue pro cálculo */
  }
  const v = await fn();
  mem.set(key, v);
  // grava em background — não bloqueia a resposta. upsert com update vazio = grava 1x só (imutável).
  prisma.analyticsCache
    .upsert({ where: { key }, create: { key, payload: v as object }, update: {} })
    .catch(() => {});
  return v;
}
