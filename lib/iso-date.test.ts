import { describe, expect, it } from "vitest";
import { isIsoDate, isoDateRange } from "./iso-date";
import { upstreamHttpStatus } from "./route-error";

describe("data civil", () => {
  it("aceita calendário real e rejeita o resto", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-01-01")).toBe(true);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-01")).toBe(false);
    expect(isIsoDate("2026-01-01; drop")).toBe(false);
  });

  it("só devolve o par quando os dois lados são datas", () => {
    expect(isoDateRange("2026-01-01", "2026-01-31")).toEqual({ since: "2026-01-01", until: "2026-01-31" });
    expect(isoDateRange("2026-01-01", "ontem")).toBeNull();
    expect(isoDateRange(undefined, "2026-01-31")).toBeNull();
  });
});

describe("status de upstream", () => {
  it("lê o código do prefixo e ignora o corpo", () => {
    expect(upstreamHttpStatus(new Error("upstream 403: negado"))).toBe(403);
    expect(upstreamHttpStatus(new Error("upstream 400: x"))).toBe(400);
    expect(upstreamHttpStatus(new Error("ETIMEDOUT 8000ms /x"))).toBeNull();
    expect(upstreamHttpStatus(new Error("corpo upstream 403 no meio"))).toBeNull();
  });
});
