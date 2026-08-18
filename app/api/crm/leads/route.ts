// GET /api/crm/leads?since=&until= — leads do workspace no período (por createdAt).
// A INTERPRETAÇÃO (canal/categoria/produto/qualificação/status/desfecho) é re-resolvida AO VIVO
// a partir do task cru (Lead.raw) com interpretTask — assim melhorias na heurística valem na hora,
// sem depender de re-sync. Webhooks (sem task cru) caem no _parsed/colunas gravados.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { interpretTask, type ClickUpTask, type Interpreted } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";

type Outcome = "won" | "lost" | "open";
function outcomeOf(status?: string | null, stage?: string | null, lossReason?: string | null): Outcome {
  const s = `${status || ""} ${stage || ""}`.toLowerCase();
  if (/(ganho|ganhou|won|fechad|closed won|convertid|cliente)/.test(s)) return "won";
  if (/(perd|lost|lose|descartad|desqualific|cancelad)/.test(s) || (lossReason && lossReason.trim())) return "lost";
  return "open";
}

interface Bucket { count: number; value: number }
function tally(map: Map<string, Bucket>, key: string | null | undefined, value: number) {
  const k = (key && String(key).trim()) || ""; // "" → cliente renderiza "Não preenchido"
  const b = map.get(k) ?? { count: 0, value: 0 };
  b.count += 1;
  b.value += value;
  map.set(k, b);
}
function toRows(map: Map<string, Bucket>) {
  return [...map.entries()].map(([key, b]) => ({ key, count: b.count, value: b.value })).sort((a, b) => b.count - a.count);
}

// dimensões gravadas no _parsed (fallback p/ webhooks / leads sem task cru).
interface Parsed {
  channel?: string | null; category?: string | null; product?: string | null;
  qualification?: string | null; stage?: string | null; status?: string | null;
  lossReason?: string | null; outcome?: Outcome | null;
}
// extrai o task ClickUp cru de Lead.raw (sem o _parsed). null se não houver custom_fields.
function rawTaskOf(raw: unknown): ClickUpTask | null {
  if (raw && typeof raw === "object" && Array.isArray((raw as { custom_fields?: unknown }).custom_fields)) {
    return raw as ClickUpTask;
  }
  return null;
}
function parsedOf(raw: unknown): Parsed {
  if (raw && typeof raw === "object") {
    const p = (raw as { _parsed?: unknown })._parsed;
    if (p && typeof p === "object") return p as Parsed;
  }
  return {};
}

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const q = new URL(req.url).searchParams;
    const since = q.get("since");
    const until = q.get("until");
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (since) createdAt.gte = new Date(since + "T00:00:00");
    if (until) createdAt.lte = new Date(until + "T23:59:59.999");

    const [cfg, leadsAll] = await Promise.all([
      prisma.crmConfig.findUnique({ where: { workspaceId: ws } }),
      prisma.lead.findMany({
        where: { workspaceId: ws, ...(since || until ? { createdAt } : {}) },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const fm = (cfg?.fieldMap ?? {}) as Record<string, string>;
    // NÃO conta tasks arquivadas (efeito imediato; o purge definitivo vem no "Ressincronizar tudo").
    const leads = leadsAll.filter((l) => (l.raw as { archived?: boolean } | null)?.archived !== true);

    const byChannel = new Map<string, Bucket>();
    const byCategory = new Map<string, Bucket>();
    const byProduct = new Map<string, Bucket>();
    const byQualification = new Map<string, Bucket>();
    const byStage = new Map<string, Bucket>();
    const byStatus = new Map<string, Bucket>();
    const lossReasons = new Map<string, Bucket>();
    const sourceTally: Record<string, Map<string, number>> = {}; // dim → {campo: contagem} p/ transparência
    const fieldSeen = new Map<string, { type: string; sample: string | null; filled: number }>(); // campos ClickUp vistos

    let totalValue = 0, pipelineValue = 0, wonValue = 0, won = 0, lost = 0, open = 0;

    const rows = leads.map((l) => {
      const task = rawTaskOf(l.raw);
      const p = parsedOf(l.raw);

      // interpretação AO VIVO quando há task cru; senão usa o gravado (webhook/colunas).
      let it: Pick<Interpreted, "channel" | "category" | "product" | "qualification" | "stage" | "status" | "lossReason" | "value" | "hasValue" | "outcome"> & { sources?: Interpreted["sources"] };
      if (task) {
        it = interpretTask(task, fm);
        // acumula as fontes (qual campo alimentou cada dimensão)
        for (const [dim, field] of Object.entries((it as Interpreted).sources || {})) {
          if (!field) continue;
          (sourceTally[dim] ??= new Map()).set(field, ((sourceTally[dim].get(field)) || 0) + 1);
        }
        // cataloga os campos personalizados vistos (nome/tipo/exemplo) p/ diagnóstico
        for (const cf of task.custom_fields ?? []) {
          const nm = cf?.name;
          if (!nm) continue;
          const has = cf?.value != null && cf?.value !== "";
          const cur = fieldSeen.get(nm) ?? { type: String(cf?.type || ""), sample: null, filled: 0 };
          if (has) {
            cur.filled += 1;
            if (!cur.sample) {
              const v = cf!.value;
              cur.sample = typeof v === "object" ? JSON.stringify(v).slice(0, 60) : String(v).slice(0, 60);
            }
          }
          fieldSeen.set(nm, cur);
        }
      } else {
        it = {
          channel: l.channel ?? p.channel ?? null,
          category: p.category ?? null,
          product: l.product ?? p.product ?? null,
          qualification: p.qualification ?? null,
          stage: l.stage ?? p.stage ?? null,
          status: l.status ?? p.status ?? null,
          lossReason: l.lossReason ?? null,
          value: l.value || 0,
          hasValue: (l.value || 0) > 0,
          outcome: p.outcome ?? null,
        };
      }

      const v = it.value || 0;
      totalValue += v;
      tally(byChannel, it.channel, v);
      tally(byCategory, it.category, v);
      tally(byProduct, it.product, v);
      tally(byQualification, it.qualification, v);
      tally(byStage, it.stage, v);
      tally(byStatus, it.status, v);

      const outcome: Outcome = it.outcome ?? outcomeOf(it.status, it.stage, it.lossReason);
      if (outcome === "won") { won += 1; wonValue += v; }
      else if (outcome === "lost") { lost += 1; if (it.lossReason && it.lossReason.trim()) tally(lossReasons, it.lossReason, v); }
      else { open += 1; pipelineValue += v; }

      return {
        id: l.id, title: l.title,
        channel: it.channel, category: it.category, product: it.product,
        qualification: it.qualification, stage: it.stage, status: it.status ?? it.stage,
        value: v, lossReason: it.lossReason, outcome, createdAt: l.createdAt,
      };
    });

    // fonte "vencedora" por dimensão (campo mais usado) — pro painel "como esta leitura funciona"
    const mapping: Record<string, string | null> = {};
    for (const dim of ["channel", "category", "product", "qualification", "stage", "status", "value", "lossReason"]) {
      const m = sourceTally[dim];
      mapping[dim] = m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null : null;
    }

    // campos ClickUp vistos (nome/tipo/quantos preenchidos/exemplo) — diagnóstico da leitura
    const availableFields = [...fieldSeen.entries()]
      .map(([name, v]) => ({ name, type: v.type, filled: v.filled, sample: v.sample }))
      .sort((a, b) => b.filled - a.filled);

    return NextResponse.json({
      ok: true,
      total: leads.length,
      totalValue, pipelineValue, wonValue, won, lost, open,
      convRate: leads.length ? won / leads.length : 0,
      byChannel: toRows(byChannel),
      byCategory: toRows(byCategory),
      byProduct: toRows(byProduct),
      byQualification: toRows(byQualification),
      byStage: toRows(byStage),
      byStatus: toRows(byStatus),
      lossReasons: toRows(lossReasons),
      mapping, // { dimensão: nome do campo ClickUp que alimentou }
      availableFields, // todos os campos personalizados vistos (p/ diagnóstico)
      leads: rows.slice(0, 500),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
