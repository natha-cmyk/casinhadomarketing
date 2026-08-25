// Lixeira de posts: GET lista os soft-deletados (restauráveis por 7 dias);
// POST { id, action:"restore"|"purge" } restaura (deletedAt=null) ou apaga de vez.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const fromDate = (dt: Date) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() });

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ items: [] }, { status: 401 });
    const rows = await prisma.post.findMany({
      where: { workspaceId: ws, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });
    const items = rows.map((p) => {
      const { y, m, d } = fromDate(p.data);
      const diasRestantes = p.deletedAt
        ? Math.max(0, 7 - Math.floor((Date.now() - p.deletedAt.getTime()) / 86400000))
        : 7;
      return { id: p.id, titulo: p.titulo, canal: p.canal, y, m, d, hora: p.hora, diasRestantes };
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json().catch(() => ({}));
    const id = String(b?.id || "");
    const action = b?.action === "purge" ? "purge" : "restore";
    if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
    if (action === "purge") {
      await prisma.post.deleteMany({ where: { id, workspaceId: ws, deletedAt: { not: null } } });
    } else {
      await prisma.post.updateMany({ where: { id, workspaceId: ws }, data: { deletedAt: null } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
