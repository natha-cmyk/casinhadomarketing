// EnvConfig do workspace ativo: redes / paineis / contas / cfgOpen / impOpen.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const c = await prisma.envConfig.findUnique({ where: { workspaceId: ws } });
    return NextResponse.json(c);
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
      redes: b.redes ?? {},
      paineis: b.paineis ?? {},
      contas: b.contas ?? {},
      cfgOpen: b.cfgOpen ?? {},
      impOpen: !!b.impOpen,
      adConfig: b.adConfig ?? {},
      customInd: b.customInd ?? {},
      calManuais: Array.isArray(b.calManuais) ? b.calManuais : [],
      calDefaults: b.calDefaults && typeof b.calDefaults === "object" ? b.calDefaults : {},
      agentsConfig: b.agentsConfig && typeof b.agentsConfig === "object" ? b.agentsConfig : {},
      widgetLayout: b.widgetLayout && typeof b.widgetLayout === "object" ? b.widgetLayout : {},
    };
    const c = await prisma.envConfig.upsert({
      where: { workspaceId: ws },
      create: { workspaceId: ws, ...data },
      update: data,
    });
    return NextResponse.json(c);
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
