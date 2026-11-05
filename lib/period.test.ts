import { describe, expect, it } from "vitest";
import { periodRange, POLICY_ADS, POLICY_AGENT, POLICY_CRM, POLICY_SOCIAL } from "./period";

const jan = { year: 2026, month: 0, quarter: 0, week: 0 };

describe("periodRange", () => {
  it("Canais/Painel: ano é 2 out–31 dez, semana 4 para no dia 28", () => {
    expect(periodRange({ ...jan, period: "ano" }, POLICY_SOCIAL)).toEqual({
      since: "2026-10-02",
      until: "2026-12-31",
    });
    expect(periodRange({ ...jan, period: "semana", week: 3 }, POLICY_SOCIAL)).toEqual({
      since: "2026-01-22",
      until: "2026-01-28",
    });
  });

  it("Ads: ano civil cheio e semana de 7 dias", () => {
    expect(periodRange({ ...jan, period: "ano" }, POLICY_ADS)).toEqual({
      since: "2026-01-01",
      until: "2026-12-31",
    });
    expect(periodRange({ ...jan, period: "semana", week: 3 }, POLICY_ADS)).toEqual({
      since: "2026-01-22",
      until: "2026-01-28",
    });
  });

  it("Geração: semana continua o mês inteiro; ano é civil", () => {
    expect(periodRange({ ...jan, period: "semana", week: 1 }, POLICY_CRM)).toEqual({
      since: "2026-01-01",
      until: "2026-01-31",
    });
    expect(periodRange({ ...jan, period: "ano" }, POLICY_CRM)).toEqual({
      since: "2026-01-01",
      until: "2026-12-31",
    });
  });

  it("agente: semana 4 vai até o fim do mês", () => {
    expect(periodRange({ ...jan, period: "semana", week: 3 }, POLICY_AGENT)).toEqual({
      since: "2026-01-22",
      until: "2026-01-31",
    });
  });

  it("teto de 90 dias só na política social, e só quando a janela passa disso", () => {
    const q3 = periodRange({ period: "trimestre", year: 2026, month: 6, quarter: 2, week: 0 }, POLICY_SOCIAL);
    expect(q3.until).toBe("2026-09-30");
    expect(q3.since).not.toBe("2026-07-01");
    const q3ads = periodRange({ period: "trimestre", year: 2026, month: 6, quarter: 2, week: 0 }, POLICY_ADS);
    expect(q3ads).toEqual({ since: "2026-07-01", until: "2026-09-30" });
  });
});
