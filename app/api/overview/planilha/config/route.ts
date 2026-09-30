// PUT /api/overview/planilha/config — personalização GLOBAL de uma aba (ocultar/ordenar/indicadores manuais).
// body: { tab, hidden:string[], custom:[{section,key,label,kind}], order:{[section]:string[]} }
// Guardado numa célula especial PlanilhaCell(metric="__config__", ano=0, mes=0). Escopo por workspace.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { bust } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABS = new Set(["insights", "geracao", "pagos"]);
const KINDS = new Set(["int", "dec", "pct", "money", "text"]);

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const tab = String(b?.tab || "");
    if (!TABS.has(tab)) return NextResponse.json({ error: "tab" }, { status: 400 });

    const hidden = Array.isArray(b?.hidden) ? b.hidden.map(String).filter(Boolean).slice(0, 500) : [];
    const rawCustom = Array.isArray(b?.custom) ? b.custom : [];
    const custom = rawCustom
      .map((c: Record<string, unknown>) => ({
        section: String(c?.section ?? "PERSONALIZADOS").slice(0, 80),
        key: String(c?.key ?? "").slice(0, 80),
        label: String(c?.label ?? "").slice(0, 120),
        kind: KINDS.has(String(c?.kind)) ? String(c?.kind) : "int",
      }))
      .filter((c: { key: string; label: string }) => c.key && !c.key.startsWith("__") && c.label)
      .slice(0, 200);
    const order = b?.order && typeof b.order === "object" && !Array.isArray(b.order) ? b.order : {};

    const texto = JSON.stringify({ hidden, custom, order });
    await prisma.planilhaCell.upsert({
      where: { workspaceId_tab_metric_ano_mes_semana: { workspaceId: ws, tab, metric: "__config__", ano: 0, mes: 0, semana: -1 } },
      create: { workspaceId: ws, tab, metric: "__config__", ano: 0, mes: 0, semana: -1, valor: null, texto, source: "config" },
      update: { texto, source: "config" },
    });
    bust(`planilha:${ws}:`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 500 });
  }
}
