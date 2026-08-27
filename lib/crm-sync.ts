// Núcleo do sync ClickUp → Lead (usado pela rota /api/crm/sync E pelo cron diário).
// Incremental por padrão (date_updated_gt = lastSyncAt); full reprocessa tudo.
import { prisma } from "@/lib/prisma";

interface ClickUpOption { id: string; name?: string; label?: string; orderindex?: unknown }
interface ClickUpCustomField { id: string; name: string; type: string; value?: unknown; type_config?: { options?: ClickUpOption[] } }
interface ClickUpTask { id: string; name?: string; status?: { status?: string; type?: string }; date_created?: string; custom_fields?: ClickUpCustomField[] }

type Dim = "channel" | "category" | "product" | "qualification" | "stage" | "status" | "value" | "lossReason" | "campaign";
const DIMS: Dim[] = ["channel", "category", "product", "qualification", "stage", "status", "value", "lossReason", "campaign"];
const SYNONYMS: Record<Dim, string[]> = {
  channel: ["canal", "origem", "source", "fonte"],
  campaign: ["campanha", "campaign", "campanha de marketing", "acao de marketing", "ação de marketing", "nome da acao", "nome da ação"],
  category: ["categoria de produto", "categoria", "linha de produto", "linha", "servico", "serviço", "segmento de produto", "segmento"],
  product: ["tipo de produto", "produto"],
  qualification: ["qualificacao", "qualificação", "classificacao", "classificação", "lead score", "rating", "estrelas", "estrela"],
  stage: ["funil", "etapa", "estagio", "estágio", "fase", "pipeline"],
  status: ["status", "situacao", "situação"],
  value: ["valor", "value", "ticket medio", "ticket", "receita"],
  lossReason: ["motivo de perda", "motivo", "perda", "loss reason", "loss"],
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function readCustomField(cf: ClickUpCustomField): string | null {
  const v = cf?.value;
  if (v == null || v === "") return null;
  const type = cf?.type;
  const opts = cf?.type_config?.options ?? [];
  const labelOf = (id: unknown): string => {
    const opt = opts.find((o) => String(o.id) === String(id) || String(o.orderindex) === String(id));
    return (opt?.name ?? opt?.label ?? String(id)) as string;
  };
  if (type === "emoji" || type === "rating") {
    const n = Number(v);
    if (!isNaN(n) && n > 0) return `${n} ${n === 1 ? "estrela" : "estrelas"}`;
    return null;
  }
  if (type === "drop_down") return labelOf(v) || null;
  if (type === "labels") {
    const arr = Array.isArray(v) ? v : [v];
    const names = arr.map(labelOf).filter(Boolean);
    return names.length ? names.join(", ") : null;
  }
  if (type === "checkbox") return v === true || v === "true" ? "Sim" : "Não";
  if (type === "number" || type === "currency" || type === "money") return String(v);
  if (type === "users" && Array.isArray(v)) {
    const names = v.map((u) => (u && typeof u === "object" ? (u as { username?: string }).username : String(u))).filter(Boolean);
    return names.length ? names.join(", ") : null;
  }
  if (typeof v === "object") {
    const nested = (v as { value?: unknown }).value;
    if (nested != null) return String(nested);
    return JSON.stringify(v);
  }
  return String(v);
}

function parseMoney(raw: string | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// Desfecho FIEL do lead: usa o campo "status CRM" (ganho/perdido) e/ou os campos de data
// "data ganho"/"data perdido" preenchidos. Sem inventar: só o que o CRM afirma.
// (Mais confiável que adivinhar por texto de status nativo.)
function resolveOutcome(task: ClickUpTask, statusVal: string | null): "won" | "lost" | "open" | null {
  const fields = task.custom_fields ?? [];
  const filled = (pred: (n: string) => boolean) =>
    fields.some((cf) => pred(norm(cf.name || "")) && cf.value != null && cf.value !== "");
  const wonDate = filled((n) => n.includes("data") && n.includes("ganho"));
  const lostDate = filled((n) => n.includes("data") && n.includes("perd"));
  const sv = norm(statusVal || "");
  const svWon = /ganho|ganhou|won|convertid/.test(sv);
  const svLost = /perd|lost|perdido/.test(sv);
  if (svWon || wonDate) return "won";
  if (svLost || lostDate) return "lost";
  // status CRM explícito mas em aberto (ex.: "em negociação") → open; senão deixa null (leads route decide)
  if (sv) return "open";
  return null;
}

// resolve o valor de cada dimensão + a FONTE (nome do campo ClickUp que alimentou), pra
// transparência ("de onde vem cada número"). fieldMap explícito tem prioridade; depois heurística.
function resolveDims(task: ClickUpTask, fm: Record<string, string>): { out: Record<Dim, string | null>; src: Record<Dim, string | null> } {
  const fields = task.custom_fields ?? [];
  const used = new Set<string>();
  const out = {} as Record<Dim, string | null>;
  const src = {} as Record<Dim, string | null>;
  for (const dim of DIMS) { out[dim] = null; src[dim] = null; }

  // 1) mapa explícito do usuário
  for (const dim of DIMS) {
    const wanted = fm[dim];
    if (wanted && wanted.trim()) {
      const cf = fields.find((c) => norm(c.name || "") === norm(wanted));
      if (cf) { out[dim] = readCustomField(cf); src[dim] = cf.name; used.add(cf.id); }
    }
  }
  // 2) heurística — roda quando o explícito NÃO resolveu. Prioriza o sinônimo MAIS ESPECÍFICO
  // (mais longo) varrendo TODOS os campos: assim "tipo de produto" vence "produto", e o campo
  // "TIPO DE PRODUTO" é escolhido em vez de "SALA/PRODUTO" (que só casa o genérico "produto").
  // Empate no mesmo sinônimo → prefere o nome de campo MAIS CURTO (mais provável de ser o exato).
  for (const dim of DIMS) {
    if (out[dim] != null) continue;
    const syns = [...SYNONYMS[dim]].sort((a, b) => b.length - a.length);
    let picked: (typeof fields)[number] | null = null;
    for (const syn of syns) {
      const cands = fields.filter((cf) => !used.has(cf.id) && norm(cf.name || "").includes(syn));
      if (cands.length) {
        cands.sort((a, b) => (a.name || "").length - (b.name || "").length);
        picked = cands[0];
        break;
      }
    }
    if (picked) { out[dim] = readCustomField(picked); src[dim] = picked.name; used.add(picked.id); }
  }
  return { out, src };
}

// Interpretação COMPLETA de uma task → dimensões + desfecho + valor + fontes. Ponto ÚNICO
// usado pelo sync E pela leitura (leads route), pra a lógica ser sempre a mesma e melhorias
// valerem na hora (sem depender de re-sync). fm = fieldMap do CrmConfig.
export interface Interpreted {
  channel: string | null; category: string | null; product: string | null;
  qualification: string | null; stage: string | null; status: string | null;
  lossReason: string | null; campaign: string | null; value: number; hasValue: boolean;
  outcome: "won" | "lost" | "open" | null;
  sources: Record<Dim, string | null>;
}
export function interpretTask(t: ClickUpTask, fm: Record<string, string>): Interpreted {
  const { out: dims, src } = resolveDims(t, fm);
  const nativeStatus = t.status?.status ?? null;
  const status = dims.status ?? nativeStatus;
  const stage = dims.stage ?? nativeStatus;
  return {
    channel: dims.channel,
    category: dims.category,
    product: dims.product, // NÃO cai pra category (senão "tipo de produto" mostra as categorias)
    qualification: dims.qualification,
    stage,
    status,
    lossReason: dims.lossReason,
    campaign: dims.campaign,
    value: parseMoney(dims.value) ?? 0,
    hasValue: dims.value != null,
    outcome: resolveOutcome(t, status),
    sources: src,
  };
}
export type { ClickUpTask };

export interface CrmSyncResult { ok: true; imported: number; incremental: boolean }
export type CrmSyncError = { ok: false; status: number; error: string };

// Sincroniza os leads (tasks ClickUp) de UM workspace. `full` força re-sync completo.
export async function syncClickupLeads(workspaceId: string, opts?: { full?: boolean }): Promise<CrmSyncResult | CrmSyncError> {
  const cfg = await prisma.crmConfig.findUnique({ where: { workspaceId } });
  if (!cfg || cfg.provider !== "clickup") return { ok: false, status: 400, error: "CRM não está no modo ClickUp." };
  if (!cfg.clickupToken || !cfg.clickupListId) return { ok: false, status: 400, error: "Informe o token e o List ID do ClickUp." };

  const forceFull = !!opts?.full;
  const sinceMs = !forceFull && cfg.lastSyncAt ? cfg.lastSyncAt.getTime() - 5 * 60 * 1000 : null;
  const incremental = sinceMs != null;
  const startedAt = new Date();

  const listId = encodeURIComponent(cfg.clickupListId);
  const tasks: ClickUpTask[] = [];
  const MAX_PAGES = 50;
  for (let page = 0; page < MAX_PAGES; page++) {
    let url = `https://api.clickup.com/api/v2/list/${listId}/task?include_closed=true&subtasks=true&page=${page}`;
    if (sinceMs != null) url += `&date_updated_gt=${sinceMs}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: cfg.clickupToken }, cache: "no-store" });
    } catch {
      return { ok: false, status: 502, error: "Não foi possível falar com o ClickUp." };
    }
    if (res.status === 401) return { ok: false, status: 400, error: "Token do ClickUp inválido ou sem acesso." };
    if (!res.ok) return { ok: false, status: 400, error: `ClickUp respondeu ${res.status}. Verifique o List ID.` };
    const body = (await res.json()) as { tasks?: ClickUpTask[]; last_page?: boolean };
    const pageTasks = Array.isArray(body?.tasks) ? body.tasks : [];
    tasks.push(...pageTasks);
    if (body?.last_page === true || pageTasks.length === 0) break;
  }

  const fm = (cfg.fieldMap ?? {}) as Record<string, string>;
  // Ignora tasks ARQUIVADAS — não entram na contagem (ClickUp já exclui por padrão no fetch,
  // mas filtramos de novo por garantia).
  const active = tasks.filter((t) => (t as unknown as { archived?: boolean }).archived !== true);
  const ops = active.map((t) => {
    const it = interpretTask(t, fm);
    const createdAt = t.date_created ? new Date(Number(t.date_created)) : new Date();
    const parsed = {
      channel: it.channel, category: it.category, product: it.product, qualification: it.qualification,
      stage: it.stage, status: it.status, value: it.hasValue ? it.value : null, lossReason: it.lossReason, campaign: it.campaign, outcome: it.outcome,
    };
    const data = {
      source: "clickup", title: t.name ?? null, channel: it.channel, product: it.product, status: it.status, stage: it.stage, value: it.value, lossReason: it.lossReason,
      createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
      raw: { ...(t as unknown as Record<string, unknown>), _parsed: parsed } as object,
    };
    return prisma.lead.upsert({
      where: { workspaceId_extId: { workspaceId, extId: t.id } },
      create: { workspaceId, extId: t.id, ...data },
      update: data,
    });
  });

  const BATCH = 20;
  for (let i = 0; i < ops.length; i += BATCH) await Promise.all(ops.slice(i, i + BATCH));

  // RECONCILIAÇÃO (só no sync COMPLETO): remove da base os leads que não vieram mais do ClickUp
  // — tasks arquivadas ou deletadas. No incremental não dá (não busca tudo), então só no full.
  if (!incremental) {
    const activeIds = active.map((t) => t.id);
    await prisma.lead.deleteMany({
      where: { workspaceId, source: "clickup", extId: { notIn: activeIds.length ? activeIds : ["__none__"] } },
    });
  }

  await prisma.crmConfig.update({ where: { workspaceId }, data: { lastSyncAt: startedAt } });
  return { ok: true, imported: ops.length, incremental };
}
