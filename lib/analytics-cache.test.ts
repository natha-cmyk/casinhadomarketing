import { describe, expect, it } from "vitest";
import { defaultWorthKeeping, insightsWorthKeeping } from "./analytics-cache";

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