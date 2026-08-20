// Convites do workspace ativo (multi-usuário). GET lista membros + convites pendentes;
// POST cria convite (só owner); DELETE cancela. A pessoa aceita entrando com o Google
// usando o e-mail convidado (ver lib/provision).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId, getSessionUser } from "@/lib/auth";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

async function isOwner(ws: string, userId: string) {
  const m = await prisma.membership.findFirst({ where: { workspaceId: ws, userId } });
  return m?.role === "owner";
}

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false }, { status: 401 });
    const [members, invites] = await Promise.all([
      prisma.membership.findMany({ where: { workspaceId: ws }, include: { user: true }, orderBy: { createdAt: "asc" } }),
      prisma.invite.findMany({ where: { workspaceId: ws, acceptedAt: null }, orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({
      ok: true,
      members: members.map((m) => ({ email: m.user.email, nome: m.user.nome, role: m.role })),
      invites: invites.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.createdAt })),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const [ws, user] = await Promise.all([getActiveWorkspaceId(), getSessionUser()]);
    if (!ws || !user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    if (!(await isOwner(ws, user.id))) return NextResponse.json({ ok: false, error: "Só o dono do ambiente pode convidar." }, { status: 403 });

    const b = await req.json().catch(() => ({}));
    const email = String(b?.email || "").trim().toLowerCase();
    const role = b?.role === "owner" ? "owner" : "member";
    if (!/.+@.+\..+/.test(email)) return NextResponse.json({ ok: false, error: "E-mail inválido." }, { status: 400 });

    // já é membro? já tem convite? evita duplicar
    const already = await prisma.membership.findFirst({ where: { workspaceId: ws, user: { email } } });
    if (already) return NextResponse.json({ ok: false, error: "Essa pessoa já faz parte do ambiente." }, { status: 400 });
    const dup = await prisma.invite.findFirst({ where: { workspaceId: ws, email, acceptedAt: null } });
    if (dup) return NextResponse.json({ ok: true, invite: { id: dup.id, email, role: dup.role } });

    const invite = await prisma.invite.create({ data: { workspaceId: ws, email, role, invitedBy: user.email || "" } });
    void logEvent(ws, "invite.created", email, { role });
    return NextResponse.json({ ok: true, invite: { id: invite.id, email, role } });
  } catch {
    return NextResponse.json({ ok: false, error: "db" }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  try {
    const [ws, user] = await Promise.all([getActiveWorkspaceId(), getSessionUser()]);
    if (!ws || !user) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    if (!(await isOwner(ws, user.id))) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const id = new URL(req.url).searchParams.get("id");
    if (id) await prisma.invite.deleteMany({ where: { id, workspaceId: ws } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
