// CrmConfig do workspace ativo — conexão do CRM (ClickUp nativo ou webhook genérico).
// GET devolve { config, workspaceId } (o workspaceId monta a URL de webhook no cliente).
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { cleanFieldMap } from "@/lib/crm-fields";
import { nextClickupToken, toPublicCrmConfig } from "@/lib/crm-public";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });
    const row = await prisma.crmConfig.findUnique({ where: { workspaceId: ws } });
    return NextResponse.json({ config: toPublicCrmConfig(row), workspaceId: ws });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}

export async function PUT(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });
    const b = await req.json();

    const provider = b.provider === "webhook" ? "webhook" : "clickup";
    // segredo de webhook: preserva o existente; gera um novo se ainda não houver.
    const existing = await prisma.crmConfig.findUnique({ where: { workspaceId: ws } });
    const webhookSecret =
      b.webhookSecret || existing?.webhookSecret || randomBytes(18).toString("hex");

    const data = {
      provider,
      clickupToken: nextClickupToken(b.clickupToken, existing?.clickupToken),
      clickupListId: (b.clickupListId ?? existing?.clickupListId ?? "") || null,
      fieldMap: b.fieldMap !== undefined ? cleanFieldMap(b.fieldMap) : existing?.fieldMap ?? {},
      webhookSecret,
    };

    const config = await prisma.crmConfig.upsert({
      where: { workspaceId: ws },
      create: { workspaceId: ws, ...data },
      update: data,
    });
    void logEvent(ws, "crm.configured", provider);
    return NextResponse.json({ config: toPublicCrmConfig(config), workspaceId: ws });
  } catch {
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
