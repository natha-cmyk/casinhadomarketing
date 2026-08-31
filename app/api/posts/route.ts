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
    const rows = await prisma.post.findMany({ where: { workspaceId: ws, deletedAt: null }, orderBy: { data: "asc" } });
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
    // BLINDAGEM MULTI-TENANT: o id é PK global; nunca tocamos um post que pertença a OUTRO
    // workspace (mesmo que um id colida). Se o id já existe noutro tenant, geramos um novo id.
    const ids = posts.map((p) => p.id).filter(Boolean);
    const existentes = ids.length
      ? await prisma.post.findMany({ where: { id: { in: ids } }, select: { id: true, workspaceId: true } })
      : [];
    const donoDe = new Map(existentes.map((e) => [e.id, e.workspaceId]));
    const remapped: { from: string; to: string }[] = [];
    for (const p of posts) {
      const fields = {
        data: toDate(p.y, p.m, p.d), hora: p.hora, titulo: p.titulo, canal: p.canal, perfil: p.perfil,
        colab: p.colab, pilar: p.pilar, formato: p.formato, funil: p.funil, legenda: p.legenda,
        cta: p.cta, hashtags: p.hashtags, arquivo: p.arquivo, status: p.status as PostStatus, contas: p.contas,
        notas: p.notas ?? "", linkRef: p.linkRef ?? "", roteiro: p.roteiro ?? "",
        overrides: (p.overrides && typeof p.overrides === "object" ? p.overrides : {}) as object,
        media: (Array.isArray(p.media) ? p.media : []) as object[],
      };
      const dono = donoDe.get(p.id);
      if (dono && dono !== ws) {
        // id colide com post de OUTRO workspace → cria com id novo (não sobrescreve o alheio)
        const novo = `${p.id}_${crypto.randomUUID()}`;
        await prisma.post.create({ data: { id: novo, workspaceId: ws, ...fields } });
        remapped.push({ from: p.id, to: novo });
      } else {
        await prisma.post.upsert({
          where: { id: p.id },
          create: { id: p.id, workspaceId: ws, ...fields },
          update: fields, // só atualiza quando o id é deste workspace (ou ainda não existe)
        });
      }
    }
    // devolve remapeamentos pro cliente atualizar os ids locais (evita recriar duplicado no próximo save)
    return NextResponse.json({ ok: true, remapped });
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
    // soft-delete: vai pra LIXEIRA (restaurável 7 dias). Purga automática via cron.
    await prisma.post.updateMany({ where: { id, workspaceId: ws }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
