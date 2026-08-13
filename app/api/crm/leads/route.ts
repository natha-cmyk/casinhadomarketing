// GET /api/crm/leads?since=&until= — leads do workspace no período (por createdAt) + agregações
// (por canal, por produto, por status/etapa, total de valor, motivos de perda).
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
    const byProduct = new Map<string, Bucket>();
    const byStatus = new Map<string, Bucket>();
    const lossReasons = new Map<string, Bucket>();

    let totalValue = 0;
    let pipelineValue = 0;
    let won = 0;
    let lost = 0;
    let open = 0;

    for (const l of leads) {
      const v = l.value || 0;
      totalValue += v;
      tally(byChannel, l.channel, v);
      tally(byProduct, l.product, v);
      tally(byStatus, l.status ?? l.stage, v);

      const outcome = outcomeOf(l.status, l.lossReason);
      if (outcome === "won") won += 1;
      else if (outcome === "lost") {
        lost += 1;
        if (l.lossReason && l.lossReason.trim()) tally(lossReasons, l.lossReason, v);
      } else {
        open += 1;
        pipelineValue += v;
      }
    }

    return NextResponse.json({
      ok: true,
      total: leads.length,
      totalValue,
      pipelineValue,
      won,
      lost,
      open,
      byChannel: toRows(byChannel),
      byProduct: toRows(byProduct),
      byStatus: toRows(byStatus),
      lossReasons: toRows(lossReasons),
      leads: leads.slice(0, 200),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
