import { describe, expect, it } from "vitest";
import { cronAuthorized } from "./cron-auth";
import { secretEquals } from "./secret-eq";

describe("cron e segredo", () => {
  it("sem CRON_SECRET não autoriza", () => {
    expect(cronAuthorized("Bearer qualquer", undefined)).toBe(false);
    expect(cronAuthorized("Bearer qualquer", "")).toBe(false);
  });

  it("Bearer certo passa; errado ou ausente não", () => {
    expect(cronAuthorized("Bearer s3cr3t", "s3cr3t")).toBe(true);
    expect(cronAuthorized("Bearer outra", "s3cr3t")).toBe(false);
    expect(cronAuthorized(null, "s3cr3t")).toBe(false);
  });

  it("secretEquals exige o mesmo valor e o mesmo tamanho", () => {
    expect(secretEquals("abc", "abc")).toBe(true);
    expect(secretEquals("abc", "abd")).toBe(false);
    expect(secretEquals("ab", "abc")).toBe(false);
  });
});
