// Perfil / Ambiente do workspace ativo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const p = await prisma.perfil.findUnique({ where: { workspaceId: ws } });
    return NextResponse.json(p);
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const data = {
      empresa: b.empresa ?? "",
      segmento: b.segmento ?? "",
      ramo: b.ramo ?? "",
      telefone: b.telefone ?? "",
      emailContato: b.emailContato ?? "",
      cidade: b.cidade ?? "",
      estado: b.estado ?? "",
      site: b.site ?? "",
      canais: Array.isArray(b.canais) ? b.canais : [],
      produtos: Array.isArray(b.produtos) ? b.produtos : [],
      relacao: b.relacao ?? {},
      logoUrl: typeof b.logoUrl === "string" ? b.logoUrl : null,
      iconUrl: typeof b.iconUrl === "string" ? b.iconUrl : null,
      iconBg: typeof b.iconBg === "string" ? b.iconBg : null,
    };
    const p = await prisma.perfil.upsert({
      where: { workspaceId: ws },
      create: { workspaceId: ws, ...data },
      update: data,
    });
    return NextResponse.json(p);
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
