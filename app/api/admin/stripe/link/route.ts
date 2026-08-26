// POST /api/admin/stripe/link { workspaceId, plano, trialDays } — admin gera um link de
// Checkout personalizado (com trial 0/7/90) pra mandar pro cliente. Só admin da agência.
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { stripeConfigured, type Plano } from "@/lib/stripe";
import { createCheckout } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";
const PLANOS: Plano[] = ["mensal", "anual_parcelado", "anual_avista"];

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!stripeConfigured()) return NextResponse.json({ error: "Stripe não configurado (faltam as chaves na Vercel)." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const workspaceId = String(b?.workspaceId || "");
  const plano = PLANOS.includes(b?.plano) ? (b.plano as Plano) : null;
  const trialDays = [0, 7, 90].includes(Number(b?.trialDays)) ? Number(b.trialDays) : 0;
  if (!workspaceId || !plano) return NextResponse.json({ error: "workspaceId e plano são obrigatórios." }, { status: 400 });
  const owner = await prisma.membership.findFirst({ where: { workspaceId, role: "owner" }, include: { user: true }, orderBy: { createdAt: "asc" } });
  try {
    const url = await createCheckout({ workspaceId, email: owner?.user.email || undefined, plano, trialDays });
    return NextResponse.json({ url, trialDays });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 200) }, { status: 400 });
  }
}
