// Normalização do JSON do webhook genérico → campos do Lead + snapshot _parsed (igual ao sync ClickUp).
const str = (v: unknown) => (v == null || v === "" ? null : String(v).trim() || null);

function parseValue(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && !isNaN(v)) return v;
  let s = String(v).trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

/** Achata envelopes comuns (`data`, `lead`, `payload`) sem perder campos da raiz. */
export function flattenWebhookBody(b: Record<string, unknown>): Record<string, unknown> {
  const nested = b.data ?? b.lead ?? b.payload;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...b, ...(nested as Record<string, unknown>) };
  }
  return b;
}

export interface WebhookLeadFields {
  extId: string | null;
  title: string | null;
  channel: string | null;
  product: string | null;
  status: string | null;
  stage: string | null;
  value: number;
  lossReason: string | null;
  createdAt?: Date;
  parsed: {
    channel?: string | null;
    category?: string | null;
    product?: string | null;
    qualification?: string | null;
    stage?: string | null;
    status?: string | null;
    lossReason?: string | null;
    campaign?: string | null;
    value?: number | null;
    outcome?: null;
  };
  raw: object;
}

export function parseWebhookLeadBody(b: Record<string, unknown>): WebhookLeadFields {
  const flat = flattenWebhookBody(b);
  const extId = str(flat.extId ?? flat.id ?? flat.externalId);
  const value = parseValue(flat.value ?? flat.valor ?? 0);
  const channel = str(flat.channel ?? flat.canal ?? flat.origem ?? flat.source);
  const product = str(flat.product ?? flat.produto);
  const status = str(flat.status ?? flat.situacao);
  const stage = str(flat.stage ?? flat.etapa ?? flat.fase ?? status);
  const lossReason = str(flat.lossReason ?? flat.loss_reason ?? flat.motivo_perda ?? flat.motivo);
  const title = str(flat.title ?? flat.name ?? flat.nome);
  const category = str(flat.category ?? flat.categoria);
  const qualification = str(flat.qualification ?? flat.qualificacao);
  const campaign = str(flat.campaign ?? flat.campanha);

  const parsed = {
    channel,
    category,
    product,
    qualification,
    stage,
    status,
    lossReason,
    campaign,
    value: value > 0 ? value : null,
    outcome: null as null,
  };

  const createdAtRaw = flat.createdAt ?? flat.created_at ?? flat.data_criacao;
  const createdAt = createdAtRaw ? new Date(String(createdAtRaw)) : undefined;

  return {
    extId,
    title,
    channel,
    product,
    status,
    stage,
    value,
    lossReason,
    ...(createdAt && !isNaN(createdAt.getTime()) ? { createdAt } : {}),
    parsed,
    raw: { ...flat, _webhook: true, _parsed: parsed },
  };
}
