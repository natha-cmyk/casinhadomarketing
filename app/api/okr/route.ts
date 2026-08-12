// OKR do workspace ativo: Objetivo + Áreas + KRs. PUT substitui a árvore.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const [obj, areas] = await Promise.all([
      prisma.objetivo.findUnique({ where: { workspaceId: ws } }),
      prisma.area.findMany({ where: { workspaceId: ws }, orderBy: { ordem: "asc" }, include: { krs: { orderBy: { ordem: "asc" } } } }),
    ]);
    return NextResponse.json({ objetivo: obj?.texto ?? "", areas });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

interface KrIn { kr: string; alvo: string; un: string; tag: string; resp: string }
interface AreaIn { nome: string; krs: KrIn[] }

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();
    const objetivo: string = b.objetivo ?? "";
    const areas: AreaIn[] = Array.isArray(b.areas) ? b.areas : [];
    await prisma.objetivo.upsert({
      where: { workspaceId: ws },
      create: { workspaceId: ws, texto: objetivo },
      update: { texto: objetivo },
    });
    // substitui a árvore do workspace (ordem = índice)
    await prisma.kR.deleteMany({ where: { area: { workspaceId: ws } } });
    await prisma.area.deleteMany({ where: { workspaceId: ws } });
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      await prisma.area.create({
        data: {
          workspaceId: ws,
          nome: a.nome ?? "",
          ordem: i,
          krs: {
            create: (a.krs ?? []).map((k, j) => ({
              kr: k.kr ?? "", alvo: k.alvo ?? "", un: k.un ?? "", tag: k.tag ?? "", resp: k.resp ?? "", ordem: j,
            })),
          },
        },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
