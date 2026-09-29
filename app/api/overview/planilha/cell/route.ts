// POST /api/overview/planilha/cell — grava/edita UMA célula manual da planilha anual.
// body: { tab, metric, ano, mes, semana?, valor?|texto? }. Upsert com source="manual".
// valor e texto ambos vazios => apaga a célula manual (reverte). Escopo por workspace.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { bust } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABS = new Set(["insights", "geracao", "pagos"]);

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();

    const tab = String(b?.tab || "");
    const metric = String(b?.metric || "").trim();
    const ano = Number(b?.ano);
    const mes = Number(b?.mes);
    const semana = b?.semana == null ? -1 : Number(b.semana);
    if (!TABS.has(tab) || !metric || metric === "__structure__") return NextResponse.json({ error: "invalid" }, { status: 400 });
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return NextResponse.json({ error: "ano" }, { status: 400 });
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) return NextResponse.json({ error: "mes" }, { status: 400 });
    if (!Number.isInteger(semana) || semana < -1 || semana > 3) return NextResponse.json({ error: "semana" }, { status: 400 });

    const valor = b?.valor == null || b.valor === "" || !Number.isFinite(Number(b.valor)) ? null : Number(b.valor);
    const texto = typeof b?.texto === "string" && b.texto.trim() ? b.texto.trim() : null;

    const whereKey = { workspaceId_tab_metric_ano_mes_semana: { workspaceId: ws, tab, metric, ano, mes, semana } };
    if (valor == null && texto == null) {
      await prisma.planilhaCell.deleteMany({ where: { workspaceId: ws, tab, metric, ano, mes, semana } });
    } else {
      await prisma.planilhaCell.upsert({
        where: whereKey,
        create: { workspaceId: ws, tab, metric, ano, mes, semana, valor, texto, source: "manual" },
        update: { valor, texto, source: "manual" },
      });
    }
    bust(`planilha:${ws}:${ano}:${tab}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 500 });
  }
}
