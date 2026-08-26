// POST /api/stripe/portal — abre o Customer Portal do Stripe (gerenciar/cancelar/cartão).
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST() {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: "Pagamento não configurado." }, { status: 503 });
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: ws.id } });
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "Nenhuma assinatura ativa pra gerenciar." }, { status: 400 });
  const session = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: `${APP_URL}/assinatura` });
  return NextResponse.json({ url: session.url });
}
