// Concorrentes do workspace ativo. GET lista (por ordem); PUT sincroniza (upsert + remove ausentes).
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

interface ConcChannelIn { tipo: string; url: string }

// normaliza os canais vindos do banco e migra os booleans legados (linkedin/youtube) p/ `canais`.
function normChannels(raw: unknown, linkedin: boolean, youtube: boolean): ConcChannelIn[] {
  const arr: ConcChannelIn[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        const tipo = String(o.tipo ?? "").trim();
        if (tipo) arr.push({ tipo, url: String(o.url ?? "").trim() });
      }
    }
  }
  const has = (t: string) => arr.some((c) => c.tipo === t);
  if (linkedin && !has("linkedin")) arr.push({ tipo: "linkedin", url: "" });
  if (youtube && !has("youtube")) arr.push({ tipo: "youtube", url: "" });
  return arr;
}

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const rows = await prisma.concorrente.findMany({ where: { workspaceId: ws }, orderBy: { ordem: "asc" } });
    const concorrentes = rows.map((c) => ({
      id: c.id, nome: c.nome, ig: c.ig,
      dominio: c.dominio ?? undefined, categoria: c.categoria,
      canais: normChannels(c.canais, c.linkedin, c.youtube),
      iconOverride: c.iconOverride ?? undefined, ordem: c.ordem,
    }));
    return NextResponse.json({ concorrentes });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

interface ConcIn {
  id: string; nome: string; ig: string;
  dominio?: string; categoria: string; canais?: ConcChannelIn[];
  iconOverride?: string; ordem: number;
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
      const canais: ConcChannelIn[] = Array.isArray(c.canais)
        ? c.canais
            .filter((x) => x && typeof x.tipo === "string" && x.tipo.trim())
            .map((x) => ({ tipo: x.tipo.trim(), url: typeof x.url === "string" ? x.url.trim() : "" }))
        : [];
      const fields = {
        nome: c.nome ?? "", ig: c.ig ?? "",
        // coerência com os booleans legados (ainda existem na coluna)
        linkedin: canais.some((x) => x.tipo === "linkedin"),
        youtube: canais.some((x) => x.tipo === "youtube"),
        dominio: c.dominio ?? null,
        categoria: typeof c.categoria === "string" ? c.categoria : "",
        canais: canais as unknown as Prisma.InputJsonValue,
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
