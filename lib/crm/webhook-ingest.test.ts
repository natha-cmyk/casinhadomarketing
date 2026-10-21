import { describe, expect, it } from "vitest";
import { parseWebhookLeadBody } from "./webhook-ingest";

describe("parseWebhookLeadBody", () => {
  it("mapeia campos canônicos e aliases PT", () => {
    const lead = parseWebhookLeadBody({
      extId: "x1",
      nome: "Ana",
      canal: "Meta Ads",
      produto: "Curso",
      situacao: "Qualificado",
      valor: "1.500,00",
    });
    expect(lead.title).toBe("Ana");
    expect(lead.channel).toBe("Meta Ads");
    expect(lead.product).toBe("Curso");
    expect(lead.status).toBe("Qualificado");
    expect(lead.value).toBe(1500);
    expect(lead.parsed.campaign).toBeNull();
  });

  it("achata envelope data e marca _webhook no raw", () => {
    const lead = parseWebhookLeadBody({
      data: { channel: "Google", title: "Lead B" },
      custom_fields: [],
    });
    expect(lead.channel).toBe("Google");
    expect(lead.title).toBe("Lead B");
    expect((lead.raw as { _webhook?: boolean })._webhook).toBe(true);
    expect((lead.raw as { custom_fields?: unknown[] }).custom_fields).toEqual([]);
  });
});
