// POST /api/crm/webhook/[workspaceId] — ingest genérico de leads de qualquer CRM.
// Rota PÚBLICA (sem sessão): autentica pelo header x-crm-secret contra o webhookSecret do workspace.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseWebhookLeadBody } from "@/lib/crm/webhook-ingest";
import { bust } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/crm/webhook/[workspaceId]">) {
  try {
    const { workspaceId } = await ctx.params;

    const cfg = await prisma.crmConfig.findUnique({ where: { workspaceId } });
    if (!cfg || !cfg.webhookSecret) {
      return NextResponse.json({ ok: false, error: "CRM não conectado." }, { status: 404 });
    }
    const secret = req.headers.get("x-crm-secret");
    if (!secret || secret !== cfg.webhookSecret) {
      return NextResponse.json({ ok: false, error: "Segredo inválido." }, { status: 401 });
    }

    let b: Record<string, unknown>;
    try {
      b = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
    }

    const lead = parseWebhookLeadBody(b);
    const data = {
      source: "webhook",
      title: lead.title,
      channel: lead.channel,
      product: lead.product,
      status: lead.status,
      stage: lead.stage,
      value: lead.value,
      lossReason: lead.lossReason,
      raw: lead.raw,
      ...(lead.createdAt ? { createdAt: lead.createdAt } : {}),
    };

    // com extId: upsert idempotente; sem extId: cria um novo registro.
    if (lead.extId) {
      await prisma.lead.upsert({
        where: { workspaceId_extId: { workspaceId, extId: lead.extId } },
        create: { workspaceId, extId: lead.extId, ...data },
        update: data,
      });
    } else {
      await prisma.lead.create({ data: { workspaceId, ...data } });
    }

    bust(`crmleads:${workspaceId}`);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
