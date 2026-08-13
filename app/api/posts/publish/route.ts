// POST /api/posts/publish — agenda/publica um post local via Zernio (POST /posts).
// Recebe { postId, publishNow? }. Lê o post do banco (scoped por workspace), mapeia
// post.contas (ids de rede da Casinha) → contas conectadas Zernio { platform, accountId },
// dispara publishPost e grava status + zernioPostId de volta no post.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PostStatus } from "@prisma/client";
import { getActiveWorkspace } from "@/lib/auth";
import { listAccounts, publishPost } from "@/lib/zernio";

// id da rede (Casinha) → plataforma Zernio. Só "x" diverge (→ twitter); o resto é 1:1.
const REDE_TO_PLAT: Record<string, string> = { x: "twitter" };

// status Zernio → status local (PostStatus).
const STATUS_MAP: Record<string, PostStatus> = {
  published: "publicado",
  scheduled: "agendado",
  pending: "agendado",
  draft: "rascunho",
  failed: "falhou",
};

// Post agendado na hora local de Natal/RN (America/Fortaleza, UTC−3, sem horário de verão)
// → instante ISO em UTC (Z). Enviamos também timezone p/ exibição no dashboard.
function toISO(data: Date, hora: string): string {
  const parts = (hora || "09:00").split(":");
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  const y = data.getUTCFullYear();
  const m = data.getUTCMonth();
  const d = data.getUTCDate();
  return new Date(Date.UTC(y, m, d, (isFinite(hh) ? hh : 9) + 3, isFinite(mm) ? mm : 0)).toISOString();
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ ok: false, error: "Faça login para agendar publicações." }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const postId = String(body?.postId || "");
    const publishNow = !!body?.publishNow;
    if (!postId) return NextResponse.json({ ok: false, error: "postId ausente." }, { status: 400 });

    const post = await prisma.post.findFirst({ where: { id: postId, workspaceId: ws.id } });
    if (!post) return NextResponse.json({ ok: false, error: "Post não encontrado neste workspace." }, { status: 404 });

    if (!ws.zernioProfileId)
      return NextResponse.json(
        { ok: false, error: "Nenhum perfil conectado. Conecte canais em Personalização antes de agendar." },
        { status: 400 }
      );

    // Contas conectadas do profile → mapa por plataforma (só as habilitadas p/ publicação).
    const { accounts } = await listAccounts(ws.zernioProfileId);
    const platforms: { platform: string; accountId: string }[] = [];
    const canaisIgnorados: string[] = [];
    for (const redeId of post.contas || []) {
      const plat = REDE_TO_PLAT[redeId] || redeId;
      const acc = accounts.find((a) => a.platform === plat && (a as { enabled?: boolean }).enabled !== false);
      if (acc) platforms.push({ platform: plat, accountId: acc._id });
      else canaisIgnorados.push(redeId);
    }
    if (!platforms.length)
      return NextResponse.json(
        { ok: false, error: "Selecione ao menos um canal conectado com permissão de publicação." },
        { status: 400 }
      );

    // Conteúdo = legenda (fallback: título). MÍDIA por ora só texto.
    // TODO(midia): se post.arquivo, subir o arquivo via /media/presign e anexar em mediaItems.
    const content = (post.legenda?.trim() || post.titulo || "").trim();

    let res;
    try {
      res = await publishPost({
        content,
        title: post.titulo || undefined,
        timezone: "America/Fortaleza",
        platforms,
        ...(publishNow ? { publishNow: true } : { scheduledFor: toISO(post.data, post.hora) }),
      });
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      let friendly = "Não foi possível publicar agora. Verifique a conexão do canal e tente de novo.";
      if (/\b403\b|permission|scope|not authorized/i.test(msg))
        friendly = "A conta conectada não tem permissão de publicação. Reconecte o canal concedendo acesso de publicação.";
      else if (/\b409\b|duplicate|dedup/i.test(msg))
        friendly = "Conteúdo idêntico já foi publicado nas últimas 24h. Ajuste a legenda para publicar de novo.";
      else if (/\b401\b/i.test(msg)) friendly = "Sessão da integração expirou. Reconecte o canal em Personalização.";
      return NextResponse.json({ ok: false, error: friendly, detail: msg.slice(0, 300) }, { status: 502 });
    }

    const zStatus = res?.post?.status || (publishNow ? "published" : "scheduled");
    const status = STATUS_MAP[zStatus] || "agendado";
    const zernioPostId = res?.post?._id || null;

    await prisma.post.update({ where: { id: post.id }, data: { status, zernioPostId } });

    return NextResponse.json({ ok: true, status, zernioPostId, canaisIgnorados });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: "Erro ao agendar. Tente novamente.", detail: String(e).slice(0, 200) },
      { status: 500 }
    );
  }
}
