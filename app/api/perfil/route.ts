// Perfil / Ambiente (singleton "main").
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const p = await prisma.perfil.findUnique({ where: { id: "main" } });
    return NextResponse.json(p);
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    const data = {
      empresa: b.empresa ?? "",
      segmento: b.segmento ?? "",
      cidade: b.cidade ?? "",
      site: b.site ?? "",
      canais: Array.isArray(b.canais) ? b.canais : [],
      produtos: Array.isArray(b.produtos) ? b.produtos : [],
      relacao: b.relacao ?? {},
    };
    const p = await prisma.perfil.upsert({
      where: { id: "main" },
      create: { id: "main", ...data },
      update: data,
    });
    return NextResponse.json(p);
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
