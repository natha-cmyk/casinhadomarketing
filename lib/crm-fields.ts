// Dimensões do lead que o sync interpreta. O fieldMap do workspace aponta
// cada uma para o nome do campo no ClickUp. Uma lista só — a tela e o PUT.

export const CRM_FIELD_KEYS = [
  "channel",
  "category",
  "product",
  "qualification",
  "stage",
  "status",
  "value",
  "lossReason",
  "campaign",
] as const;

export type CrmFieldKey = (typeof CRM_FIELD_KEYS)[number];

/** Mantém só chaves conhecidas, valor aparado; descarta vazio (a heurística assume o resto). */
export function cleanFieldMap(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (input && typeof input === "object") {
    for (const k of CRM_FIELD_KEYS) {
      const v = (input as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }
  }
  return out;
}
