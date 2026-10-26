import { describe, expect, it } from "vitest";
import { newSignupToken } from "./signup-token";

describe("newSignupToken", () => {
  it("é hex de 36 caracteres e não repete", () => {
    const a = newSignupToken();
    const b = newSignupToken();
    expect(a).toMatch(/^[0-9a-f]{36}$/);
    expect(a).not.toBe(b);
  });
});
