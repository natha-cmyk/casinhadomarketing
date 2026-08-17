// POST /api/onboarding — salva os dados da empresa (1º acesso) e marca o workspace
// como onboarded. Obrigatórios: nome empresa, telefone, e-mail, ramo. Recomendado: cidade/UF.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

interface Body {
  empresa?: string; telefone?: string; emailContato?: string; ramo?: string;
  cidade?: string; estado?: string; site?: string; produtos?: string[];
}

export async function POST(req: Request) {
  const wsId = await getActiveWorkspaceId();
  if (!wsId) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const empresa = (b.empresa || "").trim();
  const telefone = (b.telefone || "").trim();
  const emailContato = (b.emailContato || "").trim();
  const ramo = (b.ramo || "").trim();
  // obrigatórios do 1º acesso
  if (!empresa || !telefone || !emailContato || !ramo)
    return NextResponse.json({ error: "Preencha nome da empresa, telefone, e-mail e ramo de atividade." }, { status: 400 });

  const produtos = Array.isArray(b.produtos) ? b.produtos.map((p) => String(p).trim()).filter(Boolean).slice(0, 30) : undefined;
  const data = {
    empresa, telefone, emailContato, ramo,
    segmento: ramo, // mantém segmento = ramo (usado na Personalização)
    cidade: (b.cidade || "").trim(),
    estado: (b.estado || "").trim(),
    site: (b.site || "").trim(),
    ...(produtos ? { produtos } : {}),
  };

  try {
    await prisma.$transaction([
      prisma.perfil.upsert({
        where: { workspaceId: wsId },
        create: { workspaceId: wsId, ...data },
        update: data,
      }),
      prisma.workspace.update({ where: { id: wsId }, data: { onboarded: true } }),
    ]);
    await logEvent(wsId, "onboarding.completed", empresa);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
