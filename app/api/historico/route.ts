// Importador de histórico — totais mensais das planilhas antigas (pré-90 dias)
// que a integração ao vivo não puxa. Tudo escopado pelo workspace ativo.
// GET    ?platform=&ano=  → linhas de HistoricalMetric (filtros opcionais)
// POST   { platform, ano, rows:[{ metric, meses:number[12] }] } → upsert por competência
// DELETE ?platform=&ano=  → limpa o conjunto (pra reimportar)
// TODO(historico): ligar HistoricalMetric nos painéis pra períodos fora dos 90 dias.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// plataformas aceitas no importador
const PLATFORMS = new Set(["instagram", "meta_ads", "leads", "google_ads"]);

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const url = new URL(req.url);
    const platform = url.searchParams.get("platform") || undefined;
    const anoRaw = url.searchParams.get("ano");
    const ano = anoRaw ? Number(anoRaw) : undefined;

    const rows = await prisma.historicalMetric.findMany({
      where: {
        workspaceId: ws,
        ...(platform ? { platform } : {}),
        ...(ano && Number.isFinite(ano) ? { ano } : {}),
      },
      orderBy: [{ platform: "asc" }, { ano: "asc" }, { metric: "asc" }, { mes: "asc" }],
    });
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();

    const platform = String(b?.platform || "");
    const ano = Number(b?.ano);
    if (!PLATFORMS.has(platform) || !Number.isInteger(ano)) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }
    const rows: Array<{ metric?: unknown; meses?: unknown }> = Array.isArray(b?.rows) ? b.rows : [];

    // monta cada célula (metric × mês) válida e faz upsert por competência
    const ops = [];
    for (const r of rows) {
      const metric = String(r?.metric ?? "").trim();
      const meses = Array.isArray(r?.meses) ? r.meses : [];
      if (!metric) continue;
      for (let i = 0; i < 12; i++) {
        const mes = i + 1;
        const valor = Number(meses[i]) || 0;
        ops.push(
          prisma.historicalMetric.upsert({
            where: {
              workspaceId_platform_metric_ano_mes: { workspaceId: ws, platform, metric, ano, mes },
            },
            create: { workspaceId: ws, platform, metric, ano, mes, valor },
            update: { valor },
          })
        );
      }
    }
    if (!ops.length) return NextResponse.json({ error: "empty" }, { status: 400 });

    await prisma.$transaction(ops);
    return NextResponse.json({ ok: true, cells: ops.length });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const url = new URL(req.url);
    const platform = url.searchParams.get("platform") || undefined;
    const anoRaw = url.searchParams.get("ano");
    const ano = anoRaw ? Number(anoRaw) : undefined;

    const res = await prisma.historicalMetric.deleteMany({
      where: {
        workspaceId: ws,
        ...(platform ? { platform } : {}),
        ...(ano && Number.isFinite(ano) ? { ano } : {}),
      },
    });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
