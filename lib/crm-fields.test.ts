import { describe, expect, it } from "vitest";
import { cleanFieldMap } from "./crm-fields";

describe("cleanFieldMap", () => {
  it("guarda campanha e etapa e descarta chave desconhecida ou vazia", () => {
    expect(cleanFieldMap({
      channel: " Origem ",
      campaign: "Campanha",
      stage: "Etapa",
      extra: "não",
      value: "  ",
    })).toEqual({
      channel: "Origem",
      campaign: "Campanha",
      stage: "Etapa",
    });
  });
});
