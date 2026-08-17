// /api/crm/sync — integração ClickUp do funil (leads/oportunidades).
//   POST  → importa as tasks da lista configurada como Leads (upsert por workspaceId+extId).
//   GET   → detecta os campos personalizados da lista (pra o usuário mapear na UI).
// Cada task vira um Lead, resolvendo os custom_fields do ClickUp (dropdowns/labels → rótulo,
// não o id cru), aplicando o fieldMap do usuário e, quando faltar, uma heurística por nome.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── tipos ClickUp ──
interface ClickUpOption {
  id: string;
  name?: string;
  label?: string;
  orderindex?: unknown;
}
interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: ClickUpOption[] };
}
interface ClickUpTask {
  id: string;
  name?: string;
  status?: { status?: string; type?: string };
  date_created?: string;
  custom_fields?: ClickUpCustomField[];
}

// dimensões do lead que sabemos interpretar (ordem = prioridade da heurística).
// category vem antes de product pra "Categoria de Produto" não ser roubado por "produto";
// product vem antes de qualification pra "Tipo de Produto" não cair no genérico "tipo".
// stage (funil/etapa) é separado de status: funil = estágio no pipeline; status = situação do lead.
type Dim = "channel" | "category" | "product" | "qualification" | "stage" | "status" | "value" | "lossReason";
const DIMS: Dim[] = ["channel", "category", "product", "qualification", "stage", "status", "value", "lossReason"];

// sinônimos (já sem acento/minúsculos) — casados por substring contra o nome normalizado do campo.
// dentro de cada dimensão, os mais específicos vêm primeiro (ordenados por comprimento no uso).
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

// normaliza: minúsculo + remove acentos.
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// custom field do ClickUp -> valor legível (resolve dropdowns/labels via type_config.options).
function readCustomField(cf: ClickUpCustomField): string | null {
  const v = cf?.value;
  if (v == null || v === "") return null;
  const type = cf?.type;
  const opts = cf?.type_config?.options ?? [];
  const labelOf = (id: unknown): string => {
    const opt = opts.find((o) => String(o.id) === String(id) || String(o.orderindex) === String(id));
    return (opt?.name ?? opt?.label ?? String(id)) as string;
  };

  // rating por estrelas (ClickUp type "emoji"/"rating"): value é a quantidade selecionada (1–5)
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
    // formula/rollup costumam aninhar { value }
    const nested = (v as { value?: unknown }).value;
    if (nested != null) return String(nested);
    return JSON.stringify(v);
  }
  return String(v);
}

// valor monetário robusto: aceita number, "1500.50" e "R$ 1.500,50" (pt-BR). null se não houver.
function parseMoney(raw: string | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // . milhar, , decimal
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// resolve todas as dimensões de uma task: fieldMap explícito (prioridade) + heurística por nome.
function resolveDims(task: ClickUpTask, fm: Record<string, string>): Record<Dim, string | null> {
  const fields = task.custom_fields ?? [];
  const used = new Set<string>();
  const out = {} as Record<Dim, string | null>;

  // 1) mapeamento explícito do usuário (por nome do campo, case-insensitive)
  for (const dim of DIMS) {
    const wanted = fm[dim];
    if (wanted && wanted.trim()) {
      const cf = fields.find((c) => norm(c.name || "") === norm(wanted));
      if (cf) {
        out[dim] = readCustomField(cf);
        used.add(cf.id);
        continue;
      }
    }
    out[dim] = null;
  }

  // 2) heurística por sinônimos — só para dimensões que o usuário NÃO mapeou explicitamente
  for (const dim of DIMS) {
    if (fm[dim] && fm[dim].trim()) continue; // usuário mandou; respeitamos (mesmo que dê null)
    if (out[dim] != null) continue;
    const syns = [...SYNONYMS[dim]].sort((a, b) => b.length - a.length); // específicos primeiro
    for (const cf of fields) {
      if (used.has(cf.id)) continue;
      const name = norm(cf.name || "");
      if (!name) continue;
      if (syns.some((syn) => name.includes(syn))) {
        out[dim] = readCustomField(cf);
        used.add(cf.id);
        break;
      }
    }
  }

  return out;
}

// ── GET: detecta campos da lista pra a UI de mapeamento ──
export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const cfg = await prisma.crmConfig.findUnique({ where: { workspaceId: ws } });
    if (!cfg || cfg.provider !== "clickup" || !cfg.clickupToken || !cfg.clickupListId) {
      return NextResponse.json({ ok: false, error: "Configure o token e o List ID do ClickUp." }, { status: 400 });
    }

    const url = `https://api.clickup.com/api/v2/list/${encodeURIComponent(cfg.clickupListId)}/field`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: cfg.clickupToken }, cache: "no-store" });
    } catch {
      return NextResponse.json({ ok: false, error: "Não foi possível falar com o ClickUp." }, { status: 502 });
    }
    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: "Token do ClickUp inválido ou sem acesso." }, { status: 400 });
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `ClickUp respondeu ${res.status}. Verifique o List ID.` }, { status: 400 });
    }

    const body = (await res.json()) as { fields?: ClickUpCustomField[] };
    const fields = (Array.isArray(body?.fields) ? body.fields : []).map((f) => ({
      name: f.name,
      type: f.type,
      options: (f.type_config?.options ?? []).map((o) => o.name ?? o.label ?? "").filter(Boolean),
    }));

    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ── POST: importa as tasks como leads ──
// Sync INCREMENTAL por padrão: puxa só as tasks alteradas desde o último sync
// (date_updated_gt = lastSyncAt). 1º sync (ou ?full=1) = completo. Assim o botão
// "sincronizar" fica rápido no dia-a-dia em vez de reprocessar tudo toda vez.
export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const cfg = await prisma.crmConfig.findUnique({ where: { workspaceId: ws } });
    if (!cfg || cfg.provider !== "clickup") {
      return NextResponse.json({ ok: false, error: "CRM não está no modo ClickUp." }, { status: 400 });
    }
    if (!cfg.clickupToken || !cfg.clickupListId) {
      return NextResponse.json({ ok: false, error: "Informe o token e o List ID do ClickUp." }, { status: 400 });
    }

    // full=1 força re-sync completo (ignora lastSyncAt). Sem isso, é incremental.
    const forceFull = new URL(req.url).searchParams.get("full") === "1";
    // margem de 5 min pra trás cobre relógio/tasks em voo entre syncs.
    const sinceMs = !forceFull && cfg.lastSyncAt ? cfg.lastSyncAt.getTime() - 5 * 60 * 1000 : null;
    const incremental = sinceMs != null;
    const startedAt = new Date(); // carimba ANTES do fetch → próximo sync não perde nada

    // ClickUp devolve ~100 tasks por página; iteramos page=0,1,2… até last_page.
    // include_closed + subtasks: leads "ganho/perdido" costumam estar fechados.
    // date_updated_gt (incremental): só o que mudou desde o último sync.
    const listId = encodeURIComponent(cfg.clickupListId);
    const tasks: ClickUpTask[] = [];
    const MAX_PAGES = 50;
    for (let page = 0; page < MAX_PAGES; page++) {
      let url =
        `https://api.clickup.com/api/v2/list/${listId}/task` +
        `?include_closed=true&subtasks=true&page=${page}`;
      if (sinceMs != null) url += `&date_updated_gt=${sinceMs}`;
      let res: Response;
      try {
        res = await fetch(url, { headers: { Authorization: cfg.clickupToken }, cache: "no-store" });
      } catch {
        return NextResponse.json({ ok: false, error: "Não foi possível falar com o ClickUp." }, { status: 502 });
      }
      if (res.status === 401) {
        return NextResponse.json({ ok: false, error: "Token do ClickUp inválido ou sem acesso." }, { status: 400 });
      }
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: `ClickUp respondeu ${res.status}. Verifique o List ID.` },
          { status: 400 }
        );
      }
      const body = (await res.json()) as { tasks?: ClickUpTask[]; last_page?: boolean };
      const pageTasks = Array.isArray(body?.tasks) ? body.tasks : [];
      tasks.push(...pageTasks);
      // encerra quando o ClickUp sinaliza last_page ou devolve uma página vazia
      if (body?.last_page === true || pageTasks.length === 0) break;
    }

    const fm = (cfg.fieldMap ?? {}) as Record<string, string>;

    // monta os upserts e roda em LOTES paralelos (antes era 1-a-1 sequencial = lento).
    const ops = tasks.map((t) => {
      const dims = resolveDims(t, fm);
      const nativeStatus = t.status?.status ?? null;

      const channel = dims.channel;
      const category = dims.category;
      const product = dims.product ?? category; // coluna product nunca vazia se houver categoria
      const qualification = dims.qualification;
      const stage = dims.stage ?? nativeStatus; // funil/etapa: campo custom, senão status nativo da task
      const status = dims.status ?? nativeStatus; // status: campo custom, senão status nativo da task
      const lossReason = dims.lossReason;
      const value = parseMoney(dims.value) ?? 0; // nunca inventa: sem valor → 0

      const createdAt = t.date_created ? new Date(Number(t.date_created)) : new Date();

      // guardamos as dimensões resolvidas em raw._parsed (schema não tem colunas p/ category/qualification)
      const parsed = { channel, category, product, qualification, stage, status, value: dims.value != null ? value : null, lossReason };

      const data = {
        source: "clickup",
        title: t.name ?? null,
        channel,
        product,
        status,
        stage,
        value,
        lossReason,
        createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
        raw: { ...(t as unknown as Record<string, unknown>), _parsed: parsed } as object,
      };

      return prisma.lead.upsert({
        where: { workspaceId_extId: { workspaceId: ws, extId: t.id } },
        create: { workspaceId: ws, extId: t.id, ...data },
        update: data,
      });
    });

    // executa em lotes de 20 (paraleliza sem estourar o pool de conexões)
    const BATCH = 20;
    for (let i = 0; i < ops.length; i += BATCH) {
      await Promise.all(ops.slice(i, i + BATCH));
    }

    // carimba o sync (só depois de gravar tudo) → próximo é incremental
    await prisma.crmConfig.update({ where: { workspaceId: ws }, data: { lastSyncAt: startedAt } });

    return NextResponse.json({ ok: true, imported: ops.length, incremental });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
