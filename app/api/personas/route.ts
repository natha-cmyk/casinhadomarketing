// Personas do workspace ativo. GET lista (por ordem); PUT sincroniza (upsert + remove ausentes).
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const rows = await prisma.persona.findMany({ where: { workspaceId: ws }, orderBy: { ordem: "asc" } });
    const personas = rows.map((p) => ({
      id: p.id, tag: p.tag, handle: p.handle, emoji: p.emoji, cover: p.cover, nome: p.nome,
      representa: p.representa, comunica: p.comunica, dores: p.dores, canais: p.canais, gatilho: p.gatilho,
      stats: (p.stats as [string, string][]) ?? [], foto: p.foto ?? undefined, ordem: p.ordem,
    }));
    return NextResponse.json({ personas });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

interface PersonaIn {
  id: string; tag: string; handle: string; emoji: string; cover: string; nome: string;
  representa: string; comunica: string; dores: string[]; canais: string; gatilho: string;
  stats: [string, string][]; foto?: string; ordem: number;
}

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const personas: PersonaIn[] = Array.isArray(b.personas) ? b.personas : [];
    const ids = personas.map((p) => p.id);
    // remove só as personas DESTE workspace que sumiram
    await prisma.persona.deleteMany({ where: { workspaceId: ws, id: { notIn: ids.length ? ids : ["__none__"] } } });
    for (const p of personas) {
      const fields = {
        tag: p.tag ?? "", handle: p.handle ?? "", emoji: p.emoji ?? "", cover: p.cover ?? "", nome: p.nome ?? "",
        representa: p.representa ?? "", comunica: p.comunica ?? "", dores: Array.isArray(p.dores) ? p.dores : [],
        canais: p.canais ?? "", gatilho: p.gatilho ?? "",
        stats: (Array.isArray(p.stats) ? p.stats : []) as unknown as Prisma.InputJsonValue,
        foto: p.foto ?? null, ordem: p.ordem ?? 0,
      };
      await prisma.persona.upsert({
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
