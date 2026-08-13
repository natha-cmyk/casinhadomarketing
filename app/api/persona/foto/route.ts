// POST /api/persona/foto — STUB de geração de foto de persona por IA.
// body: { nome?, seed? }. Por ora devolve um avatar determinístico (placeholder) por nome,
// pra o construtor exibir uma prévia. A geração real por modelo de imagem é follow-up.
// TODO(ia-foto): gerar imagem real com modelo de imagem quando a chave estiver disponível.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = String(body?.nome || body?.seed || "").trim() || "persona";
    // seed determinístico → mesmo nome gera sempre o mesmo avatar (prévia estável)
    const seed = encodeURIComponent(raw.slice(0, 64));
    const foto = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundType=gradientLinear`;
    // placeholder:true sinaliza ao cliente que é prévia, não a imagem final da IA
    return NextResponse.json({ foto, placeholder: true });
  } catch {
    // não quebra o fluxo do construtor: cliente trata { pending:true } como "sem foto agora"
    return NextResponse.json({ pending: true }, { status: 200 });
  }
}
