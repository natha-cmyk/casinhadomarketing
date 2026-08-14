// GET /api/crm/leads?since=&until= — leads do workspace no período (por createdAt) + agregações
// (por canal, categoria, produto, qualificação, status/etapa, total de valor, motivos de perda).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// classifica o estágio do lead a partir do texto livre de status (ClickUp/webhook)
type Outcome = "won" | "lost" | "open";
function outcomeOf(status?: string | null, lossReason?: string | null): Outcome {
  const s = (status || "").toLowerCase();
  if (/(ganho|ganhou|won|fechad|closed won|convertid|cliente)/.test(s)) return "won";
  if (/(perd|lost|lose|descartad|desqualific|cancelad)/.test(s) || (lossReason && lossReason.trim())) return "lost";
  return "open";
}

interface Bucket {
  count: number;
  value: number;
}
function tally(map: Map<string, Bucket>, key: string | null | undefined, value: number) {
  const k = (key && String(key).trim()) || "—";
  const b = map.get(k) ?? { count: 0, value: 0 };
  b.count += 1;
  b.value += value;
  map.set(k, b);
}
function toRows(map: Map<string, Bucket>) {
  return [...map.entries()]
    .map(([key, b]) => ({ key, count: b.count, value: b.value }))
    .sort((a, b) => b.count - a.count);
}

// dimensões extras resolvidas no sync (category/qualification não têm coluna própria no schema).
interface Parsed {
  channel?: string | null;
  category?: string | null;
  product?: string | null;
  qualification?: string | null;
  status?: string | null;
  lossReason?: string | null;
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

    const leads = await prisma.lead.findMany({
      where: { workspaceId: ws, ...(since || until ? { createdAt } : {}) },
      orderBy: { createdAt: "desc" },
    });

    const byChannel = new Map<string, Bucket>();
    const byCategory = new Map<string, Bucket>();
    const byProduct = new Map<string, Bucket>();
    const byQualification = new Map<string, Bucket>();
    const byStatus = new Map<string, Bucket>();
    const lossReasons = new Map<string, Bucket>();

    let totalValue = 0;
    let pipelineValue = 0;
    let wonValue = 0;
    let won = 0;
    let lost = 0;
    let open = 0;

    // leads enriquecidos p/ a tabela (inclui category/qualification vindos de raw._parsed)
    const rows = leads.map((l) => {
      const p = parsedOf(l.raw);
      const v = l.value || 0;
      const channel = l.channel ?? p.channel ?? null;
      const category = p.category ?? null;
      const product = l.product ?? p.product ?? null;
      const qualification = p.qualification ?? null;

      totalValue += v;
      tally(byChannel, channel, v);
      tally(byCategory, category, v);
      tally(byProduct, product, v);
      tally(byQualification, qualification, v);
      tally(byStatus, l.status ?? l.stage, v);

      const outcome = outcomeOf(l.status ?? l.stage, l.lossReason);
      if (outcome === "won") {
        won += 1;
        wonValue += v;
      } else if (outcome === "lost") {
        lost += 1;
        if (l.lossReason && l.lossReason.trim()) tally(lossReasons, l.lossReason, v);
      } else {
        open += 1;
        pipelineValue += v;
      }

      return {
        id: l.id,
        title: l.title,
        channel,
        category,
        product,
        qualification,
        status: l.status ?? l.stage,
        value: v,
        lossReason: l.lossReason,
        outcome,
        createdAt: l.createdAt,
      };
    });

    return NextResponse.json({
      ok: true,
      total: leads.length,
      totalValue,
      pipelineValue,
      wonValue,
      won,
      lost,
      open,
      byChannel: toRows(byChannel),
      byCategory: toRows(byCategory),
      byProduct: toRows(byProduct),
      byQualification: toRows(byQualification),
      byStatus: toRows(byStatus),
      lossReasons: toRows(lossReasons),
      leads: rows.slice(0, 200),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
