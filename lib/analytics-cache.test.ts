import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    analyticsCache: {
      findUnique,
      upsert,
    },
  },
}));

import { cachedImmutable, defaultWorthKeeping, insightsWorthKeeping, resetAnalyticsCacheForTests } from "./analytics-cache";

describe("cache de período fechado", () => {
  it("não guarda null nem lista vazia", () => {
    expect(defaultWorthKeeping(null)).toBe(false);
    expect(defaultWorthKeeping(undefined)).toBe(false);
    expect(defaultWorthKeeping([])).toBe(false);
    expect(defaultWorthKeeping([{ platform: "instagram" }])).toBe(true);
  });

  it("insights tudo null é falha; stories 0 é resposta real", () => {
    expect(insightsWorthKeeping({ insights: null, followers: null, stories: null })).toBe(false);
    expect(insightsWorthKeeping(null)).toBe(false);
    expect(insightsWorthKeeping({ stories: 0, insights: null })).toBe(true);
    expect(insightsWorthKeeping({ insights: { metrics: {} } })).toBe(true);
  });
});

describe("cache imutável em voo", () => {
  beforeEach(() => {
    resetAnalyticsCacheForTests();
    findUnique.mockReset();
    upsert.mockReset();
    findUnique.mockResolvedValue(null);
    upsert.mockResolvedValue({});
  });

  it("colapsa o cálculo simultâneo da mesma chave", async () => {
    let n = 0;
    const fn = () =>
      new Promise<{ n: number }>((resolve) => {
        n += 1;
        setTimeout(() => resolve({ n }), 20);
      });
    const [a, b] = await Promise.all([cachedImmutable("sf", fn), cachedImmutable("sf", fn)]);
    expect(n).toBe(1);
    expect(a).toEqual(b);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("não congela null e recalcula", async () => {
    let n = 0;
    const fn = async () => {
      n += 1;
      return n === 1 ? null : { ok: true };
    };
    await expect(cachedImmutable("vazio", fn)).resolves.toBeNull();
    await expect(cachedImmutable("vazio", fn)).resolves.toEqual({ ok: true });
    expect(n).toBe(2);
  });

  it("solta a entrada mais antiga quando passa do teto", async () => {
    for (let i = 0; i < 501; i++) {
      await cachedImmutable(`k${i}`, async () => ({ n: i }));
    }
    let recomputed = 0;
    await cachedImmutable("k0", async () => {
      recomputed += 1;
      return { n: -1 };
    });
    expect(recomputed).toBe(1);
  });
});