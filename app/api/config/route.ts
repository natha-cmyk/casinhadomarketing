// EnvConfig (singleton "main"): redes / paineis / contas / cfgOpen / impOpen.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const c = await prisma.envConfig.findUnique({ where: { id: "main" } });
    return NextResponse.json(c);
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

export async function PUT(req: Request) {
  try {
    const b = await req.json();
    const data = {
      redes: b.redes ?? {},
      paineis: b.paineis ?? {},
      contas: b.contas ?? {},
      cfgOpen: b.cfgOpen ?? {},
      impOpen: !!b.impOpen,
    };
    const c = await prisma.envConfig.upsert({
      where: { id: "main" },
      create: { id: "main", ...data },
      update: data,
    });
    return NextResponse.json(c);
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
