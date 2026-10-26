import { describe, expect, it } from "vitest";
import { nextClickupToken, toPublicCrmConfig } from "./crm-public";

describe("config pública do CRM", () => {
  it("não devolve o token e marca se ele existe", () => {
    const pub = toPublicCrmConfig({
      provider: "clickup",
      clickupToken: "pk_segredo",
      webhookSecret: "abc",
    });
    expect(pub).toEqual({ provider: "clickup", webhookSecret: "abc", hasClickupToken: true });
    expect(pub && "clickupToken" in pub).toBe(false);
  });

  it("token vazio no PUT mantém o salvo; null apaga; texto troca", () => {
    expect(nextClickupToken(undefined, "pk_old")).toBe("pk_old");
    expect(nextClickupToken("", "pk_old")).toBe("pk_old");
    expect(nextClickupToken(null, "pk_old")).toBeNull();
    expect(nextClickupToken(" pk_new ", "pk_old")).toBe("pk_new");
  });
});
