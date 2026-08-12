// Concorrentes do workspace ativo. GET lista (por ordem); PUT sincroniza (upsert + remove ausentes).
import { NextResponse } from "next/server";
import type { CompCategoria } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const rows = await prisma.concorrente.findMany({ where: { workspaceId: ws }, orderBy: { ordem: "asc" } });
    const concorrentes = rows.map((c) => ({
      id: c.id, nome: c.nome, ig: c.ig, linkedin: c.linkedin, youtube: c.youtube,
      dominio: c.dominio ?? undefined, categoria: c.categoria, iconOverride: c.iconOverride ?? undefined, ordem: c.ordem,
    }));
    return NextResponse.json({ concorrentes });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

interface ConcIn {
  id: string; nome: string; ig: string; linkedin: boolean; youtube: boolean;
  dominio?: string; categoria: string; iconOverride?: string; ordem: number;
}

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const concorrentes: ConcIn[] = Array.isArray(b.concorrentes) ? b.concorrentes : [];
    const ids = concorrentes.map((c) => c.id);
    // remove só os concorrentes DESTE workspace que sumiram
    await prisma.concorrente.deleteMany({ where: { workspaceId: ws, id: { notIn: ids.length ? ids : ["__none__"] } } });
    for (const c of concorrentes) {
      const fields = {
        nome: c.nome ?? "", ig: c.ig ?? "", linkedin: !!c.linkedin, youtube: !!c.youtube,
        dominio: c.dominio ?? null, categoria: c.categoria as CompCategoria,
        iconOverride: c.iconOverride ?? null, ordem: c.ordem ?? 0,
      };
      await prisma.concorrente.upsert({
        where: { id: c.id },
        create: { id: c.id, workspaceId: ws, ...fields },
        update: fields,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
