import { describe, expect, it } from "vitest";
import { platOf, redeOf } from "./rede";

describe("rede", () => {
  it("x e twitter são a mesma rede, o resto passa direto", () => {
    expect(platOf("x")).toBe("twitter");
    expect(redeOf("twitter")).toBe("x");
    expect(platOf("instagram")).toBe("instagram");
    expect(redeOf("instagram")).toBe("instagram");
    expect(platOf(redeOf("twitter"))).toBe("twitter");
  });
});
