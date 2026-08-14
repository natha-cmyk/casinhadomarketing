// POST /api/posts/presign — devolve URL de upload presignada da Zernio p/ o browser
// enviar o arquivo DIRETO ao storage (não passa pelo nosso servidor → sem limite de 4.5MB).
// Body: { filename, contentType, size? }  →  { uploadUrl, publicUrl }.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { presignMedia } from "@/lib/zernio";

export const dynamic = "force-dynamic";

// tipos aceitos pela Zernio (imagem/vídeo/gif/pdf) — barra o resto antes de gastar chamada
const OK = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/mpeg", "video/quicktime", "video/avi", "video/x-msvideo", "video/webm", "video/x-m4v",
  "application/pdf",
]);
const MAX = 5 * 1024 * 1024 * 1024; // 5GB

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { filename?: string; contentType?: string; size?: number };
  const filename = (b.filename || "").trim();
  const contentType = (b.contentType || "").trim();
  if (!filename || !contentType) return NextResponse.json({ error: "filename/contentType ausentes" }, { status: 400 });
  if (!OK.has(contentType)) return NextResponse.json({ error: `tipo não suportado: ${contentType}` }, { status: 400 });
  if (b.size != null && b.size > MAX) return NextResponse.json({ error: "arquivo acima de 5GB" }, { status: 400 });

  try {
    const r = await presignMedia({ filename, contentType, size: b.size });
    return NextResponse.json({ uploadUrl: r.uploadUrl, publicUrl: r.publicUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
