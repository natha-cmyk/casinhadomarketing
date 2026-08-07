// Posts do calendário. GET lista; PUT sincroniza (upsert por id + remove ausentes).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PostStatus } from "@prisma/client";

// data (DateTime) ↔ y/m/d do cliente (meio-dia UTC evita drift de fuso)
const toDate = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d, 12));
const fromDate = (dt: Date) => ({ y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate() });

export async function GET() {
  try {
    const rows = await prisma.post.findMany({ orderBy: { data: "asc" } });
    const posts = rows.map((p) => {
      const { y, m, d } = fromDate(p.data);
      return {
        id: p.id, y, m, d, hora: p.hora, titulo: p.titulo, canal: p.canal, perfil: p.perfil,
        colab: p.colab, pilar: p.pilar, formato: p.formato, funil: p.funil, legenda: p.legenda,
        cta: p.cta, hashtags: p.hashtags, arquivo: p.arquivo, status: p.status, contas: p.contas,
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
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    const posts: PostIn[] = Array.isArray(b.posts) ? b.posts : [];
    const ids = posts.map((p) => p.id);
    await prisma.post.deleteMany({ where: { id: { notIn: ids.length ? ids : ["__none__"] } } });
    for (const p of posts) {
      const fields = {
        data: toDate(p.y, p.m, p.d), hora: p.hora, titulo: p.titulo, canal: p.canal, perfil: p.perfil,
        colab: p.colab, pilar: p.pilar, formato: p.formato, funil: p.funil, legenda: p.legenda,
        cta: p.cta, hashtags: p.hashtags, arquivo: p.arquivo, status: p.status as PostStatus, contas: p.contas,
      };
      await prisma.post.upsert({ where: { id: p.id }, create: { id: p.id, ...fields }, update: fields });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
