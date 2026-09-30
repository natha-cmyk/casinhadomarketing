// Biblioteca de relatórios por workspace.
// GET    ?panel=        → lista (newest first; filtro opcional por painel)
// POST   {panel,title,content,agentKey,agentName,periodLabel} → salva
// DELETE ?id=           → remove
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ reports: [] }, { status: 401 });
    const panel = new URL(req.url).searchParams.get("panel") || undefined;
    const reports = await prisma.report.findMany({
      where: { workspaceId: ws, ...(panel ? { panel } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ reports });
  } catch (e) {
    return NextResponse.json({ reports: [], error: String(e).slice(0, 160) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const title = String(b?.title || "").trim().slice(0, 200);
    const content = String(b?.content || "").trim();
    const panel = String(b?.panel || "overview").slice(0, 60);
    if (!title || !content) return NextResponse.json({ error: "vazio" }, { status: 400 });
    const r = await prisma.report.create({
      data: {
        workspaceId: ws, panel, title, content,
        agentKey: b?.agentKey ? String(b.agentKey).slice(0, 40) : null,
        agentName: b?.agentName ? String(b.agentName).slice(0, 80) : null,
        periodLabel: b?.periodLabel ? String(b.periodLabel).slice(0, 80) : null,
      },
    });
    return NextResponse.json({ ok: true, report: r });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
    await prisma.report.deleteMany({ where: { id, workspaceId: ws } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 160) }, { status: 500 });
  }
}
