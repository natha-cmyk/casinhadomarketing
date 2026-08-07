// OKR: Objetivo (singleton) + Áreas + KRs. PUT substitui a árvore inteira (editor).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [obj, areas] = await Promise.all([
      prisma.objetivo.findUnique({ where: { id: "main" } }),
      prisma.area.findMany({ orderBy: { ordem: "asc" }, include: { krs: { orderBy: { ordem: "asc" } } } }),
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
    const b = await req.json();
    const objetivo: string = b.objetivo ?? "";
    const areas: AreaIn[] = Array.isArray(b.areas) ? b.areas : [];
    await prisma.objetivo.upsert({
      where: { id: "main" },
      create: { id: "main", texto: objetivo },
      update: { texto: objetivo },
    });
    // substitui a árvore (ordem = índice)
    await prisma.kR.deleteMany();
    await prisma.area.deleteMany();
    for (let i = 0; i < areas.length; i++) {
      const a = areas[i];
      await prisma.area.create({
        data: {
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
