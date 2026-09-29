// GET /api/overview/planilha?year=YYYY&tab=insights|geracao|planejamento|pagos
// Matriz anual da planilha (espelho automático dos dados da plataforma), escopada por workspace.
// Cache leve por (workspace + ano + aba). Uma aba por chamada (payload enxuto).
import { NextResponse } from "next/server";
import { getActiveWorkspaceId } from "@/lib/auth";
import { cached } from "@/lib/ttl-cache";
import { buildTab, COVERAGE } from "@/lib/planilha/build";
import { CUR_YEAR } from "@/lib/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const TABS = new Set(["insights", "geracao", "planejamento", "pagos"]);

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const q = new URL(req.url).searchParams;
    const tab = TABS.has(q.get("tab") || "") ? (q.get("tab") as string) : "insights";
    const yearRaw = Number(q.get("year"));
    const year = Number.isInteger(yearRaw) && yearRaw >= 2020 && yearRaw <= CUR_YEAR + 1 ? yearRaw : CUR_YEAR;

    const key = `planilha:${ws}:${year}:${tab}`;
    const payload = await cached(key, 60_000, async () => ({
      year,
      tab,
      data: await buildTab(ws, year, tab),
      coverage: COVERAGE[tab] || "",
      updatedAt: new Date().toISOString(),
    }));

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
