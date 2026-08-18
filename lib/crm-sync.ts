// Núcleo do sync ClickUp → Lead (usado pela rota /api/crm/sync E pelo cron diário).
// Incremental por padrão (date_updated_gt = lastSyncAt); full reprocessa tudo.
import { prisma } from "@/lib/prisma";

interface ClickUpOption { id: string; name?: string; label?: string; orderindex?: unknown }
interface ClickUpCustomField { id: string; name: string; type: string; value?: unknown; type_config?: { options?: ClickUpOption[] } }
interface ClickUpTask { id: string; name?: string; status?: { status?: string; type?: string }; date_created?: string; custom_fields?: ClickUpCustomField[] }

type Dim = "channel" | "category" | "product" | "qualification" | "stage" | "status" | "value" | "lossReason";
const DIMS: Dim[] = ["channel", "category", "product", "qualification", "stage", "status", "value", "lossReason"];
const SYNONYMS: Record<Dim, string[]> = {
  channel: ["canal", "origem", "source", "fonte"],
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

function resolveDims(task: ClickUpTask, fm: Record<string, string>): Record<Dim, string | null> {
  const fields = task.custom_fields ?? [];
  const used = new Set<string>();
  const out = {} as Record<Dim, string | null>;
  for (const dim of DIMS) {
    const wanted = fm[dim];
    if (wanted && wanted.trim()) {
      const cf = fields.find((c) => norm(c.name || "") === norm(wanted));
      if (cf) { out[dim] = readCustomField(cf); used.add(cf.id); continue; }
    }
    out[dim] = null;
  }
  for (const dim of DIMS) {
    if (fm[dim] && fm[dim].trim()) continue;
    if (out[dim] != null) continue;
    const syns = [...SYNONYMS[dim]].sort((a, b) => b.length - a.length);
    for (const cf of fields) {
      if (used.has(cf.id)) continue;
      const name = norm(cf.name || "");
      if (!name) continue;
      if (syns.some((syn) => name.includes(syn))) { out[dim] = readCustomField(cf); used.add(cf.id); break; }
    }
  }
  return out;
}

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
  const ops = tasks.map((t) => {
    const dims = resolveDims(t, fm);
    const nativeStatus = t.status?.status ?? null;
    const channel = dims.channel;
    const category = dims.category;
    const product = dims.product; // NÃO cai pra category (senão "tipo de produto" mostra as categorias)
    const qualification = dims.qualification;
    const stage = dims.stage ?? nativeStatus;
    const status = dims.status ?? nativeStatus;
    const lossReason = dims.lossReason;
    const value = parseMoney(dims.value) ?? 0;
    const createdAt = t.date_created ? new Date(Number(t.date_created)) : new Date();
    const parsed = { channel, category, product, qualification, stage, status, value: dims.value != null ? value : null, lossReason };
    const data = {
      source: "clickup", title: t.name ?? null, channel, product, status, stage, value, lossReason,
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

  await prisma.crmConfig.update({ where: { workspaceId }, data: { lastSyncAt: startedAt } });
  return { ok: true, imported: ops.length, incremental };
}
