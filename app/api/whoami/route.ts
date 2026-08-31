// GET /api/whoami — diagnóstico de tenant do usuário logado.
// Abra logado em CADA conta (Seahub e Reslo) e compare o workspaceId: se for IGUAL, as duas
// contas estão no MESMO workspace (compartilham posts). Se DIFERENTE, o isolamento está correto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.email) return NextResponse.json({ ok: false, error: "não logado" }, { status: 401 });
    const wsId = await getActiveWorkspaceId();
    if (!wsId) return NextResponse.json({ ok: false, error: "sem workspace" }, { status: 401 });

    const [ws, members, postCount, postsSample] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: wsId }, select: { id: true, nome: true } }),
      prisma.membership.findMany({ where: { workspaceId: wsId }, select: { role: true, user: { select: { email: true } } } }),
      prisma.post.count({ where: { workspaceId: wsId, deletedAt: null } }),
      prisma.post.findMany({ where: { workspaceId: wsId, deletedAt: null }, orderBy: { data: "asc" }, take: 8, select: { id: true, titulo: true, canal: true, perfil: true, data: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      email: user.email,
      workspaceId: wsId,
      workspaceNome: ws?.nome,
      membros: members.map((m) => ({ email: m.user?.email, role: m.role })),
      totalPosts: postCount,
      amostraPosts: postsSample.map((p) => ({ id: p.id, titulo: p.titulo, canal: p.canal, perfil: p.perfil, data: p.data })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
