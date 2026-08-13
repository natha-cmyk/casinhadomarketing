// POST /api/crm/webhook/[workspaceId] — ingest genérico de leads de qualquer CRM.
// Rota PÚBLICA (sem sessão): autentica pelo header x-crm-secret contra o webhookSecret do workspace.
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const str = (v: unknown) => (v == null ? null : String(v));

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

    const extId = str(b.extId ?? b.id ?? b.externalId);
    const value = Number(String(b.value ?? 0).replace(/[^0-9.-]/g, "")) || 0;
    const data = {
      source: "webhook",
      title: str(b.title ?? b.name),
      channel: str(b.channel),
      product: str(b.product),
      status: str(b.status),
      stage: str(b.stage ?? b.status),
      value,
      lossReason: str(b.lossReason ?? b.loss_reason),
      raw: b as object,
      ...(b.createdAt ? { createdAt: new Date(String(b.createdAt)) } : {}),
    };

    // com extId: upsert idempotente; sem extId: cria um novo registro.
    if (extId) {
      await prisma.lead.upsert({
        where: { workspaceId_extId: { workspaceId, extId } },
        create: { workspaceId, extId, ...data },
        update: data,
      });
    } else {
      await prisma.lead.create({ data: { workspaceId, ...data } });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
