// Posts do calendário do workspace ativo. GET lista; PUT sincroniza (upsert + remove ausentes).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PostStatus } from "@prisma/client";
import { getActiveWorkspaceId } from "@/lib/auth";

const toDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12));
const fromDate = (dt: Date) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() });

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const rows = await prisma.post.findMany({ where: { workspaceId: ws }, orderBy: { data: "asc" } });
    const posts = rows.map((p) => {
      const { y, m, d } = fromDate(p.data);
      return {
        id: p.id, y, m, d, hora: p.hora, titulo: p.titulo, canal: p.canal, perfil: p.perfil,
        colab: p.colab, pilar: p.pilar, formato: p.formato, funil: p.funil, legenda: p.legenda,
        cta: p.cta, hashtags: p.hashtags, arquivo: p.arquivo, status: p.status, contas: p.contas,
        notas: p.notas, linkRef: p.linkRef, roteiro: p.roteiro,
        overrides: p.overrides && typeof p.overrides === "object" ? p.overrides : {},
        media: Array.isArray(p.media) ? p.media : [],
      };
    });
    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

interface PostIn {
  id: string; y: number; m: number; d: number; hora: string; titulo: string; canal: string;
  perfil: string; colab: string; pilar: string; formato: string; funil: string; legenda: string;
  cta: string; hashtags: string; arquivo: string; status: string; contas: string[];
  notas?: string; linkRef?: string; roteiro?: string;
  overrides?: Record<string, { caption?: string }>;
  media?: unknown[];
}

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const posts: PostIn[] = Array.isArray(b.posts) ? b.posts : [];
    // IMPORTANTE: salvar é APENAS upsert. NUNCA apagamos aqui — um carregamento vazio
    // (falha transitória do GET) não pode mais destruir posts. Exclusão só via DELETE explícito.
    for (const p of posts) {
      const fields = {
        data: toDate(p.y, p.m, p.d), hora: p.hora, titulo: p.titulo, canal: p.canal, perfil: p.perfil,
        colab: p.colab, pilar: p.pilar, formato: p.formato, funil: p.funil, legenda: p.legenda,
        cta: p.cta, hashtags: p.hashtags, arquivo: p.arquivo, status: p.status as PostStatus, contas: p.contas,
        notas: p.notas ?? "", linkRef: p.linkRef ?? "", roteiro: p.roteiro ?? "",
        overrides: (p.overrides && typeof p.overrides === "object" ? p.overrides : {}) as object,
        media: (Array.isArray(p.media) ? p.media : []) as object[],
      };
      await prisma.post.upsert({
        where: { id: p.id },
        create: { id: p.id, workspaceId: ws, ...fields },
        update: fields,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}

// DELETE /api/posts?id=... — exclusão EXPLÍCITA de um post (única forma de remover do banco).
export async function DELETE(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id ausente" }, { status: 400 });
    await prisma.post.deleteMany({ where: { id, workspaceId: ws } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
