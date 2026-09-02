// GET /api/crm/channels — LEVE: só a lista de canais do CRM + contagem (groupBy na coluna Lead.channel,
// sem reinterpretar os leads). Usado pelo painel de canais (vínculo do CRM). Muito mais barato que
// /api/crm/leads (que lê e reinterpreta tudo) — evita saturar o pool de conexões do Postgres.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { cached } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, channels: [] }, { status: 401 });
    const channels = await cached(`crmchannels:${ws}`, 60_000, async () => {
      const rows = await prisma.lead.groupBy({ by: ["channel"], where: { workspaceId: ws }, _count: { _all: true } });
      return rows
        .map((r) => ({ canal: (r.channel || "").trim(), total: r._count._all }))
        .filter((c) => c.canal)
        .sort((a, b) => b.total - a.total);
    });
    return NextResponse.json({ ok: true, channels });
  } catch (e) {
    return NextResponse.json({ ok: false, channels: [], error: String(e).slice(0, 160) }, { status: 500 });
  }
}
