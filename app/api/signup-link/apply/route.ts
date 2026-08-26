// POST /api/signup-link/apply { token } — aplica um link de cadastro ao workspace atual:
// abre a assinatura em TRIAL (sem cartão) e marca o link como usado. Idempotente.
import { NextResponse } from "next/server";
import { getActiveWorkspace, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripeConfigured, type Plano } from "@/lib/stripe";
import { startTrial } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const [ws, user] = await Promise.all([getActiveWorkspace(), getSessionUser()]);
  if (!ws || !user) return NextResponse.json({ ok: false }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const token = String(b?.token || "");
  if (!token) return NextResponse.json({ ok: false, error: "token" }, { status: 400 });

  const link = await prisma.signupLink.findUnique({ where: { token } });
  if (!link) return NextResponse.json({ ok: false, error: "link inválido" }, { status: 404 });
  if (link.usadoEm) return NextResponse.json({ ok: true, already: true }); // já usado

  // não recria se o workspace já tem assinatura no Stripe
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: ws.id } });
  if (sub?.stripeSubscriptionId) {
    await prisma.signupLink.update({ where: { id: link.id }, data: { usadoPorEmail: user.email, usadoEm: new Date() } });
    return NextResponse.json({ ok: true, already: true });
  }

  if (link.trialDays > 0) {
    if (!stripeConfigured()) return NextResponse.json({ ok: false, error: "pagamento não configurado" }, { status: 503 });
    const r = await startTrial({ workspaceId: ws.id, email: user.email || undefined, plano: link.plano as Plano, trialDays: link.trialDays });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  await prisma.signupLink.update({ where: { id: link.id }, data: { usadoPorEmail: user.email, usadoEm: new Date() } });
  return NextResponse.json({ ok: true, trialDays: link.trialDays });
}
