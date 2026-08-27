// POST /api/stripe/webhook — recebe eventos do Stripe e sincroniza a assinatura/faturas.
// Verifica a assinatura com STRIPE_WEBHOOK_SECRET (corpo CRU obrigatório).
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { syncSubscription } from "@/lib/stripe-sync";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ ok: false, error: "stripe não configurado" }, { status: 503 });

  const sig = req.headers.get("stripe-signature") || "";
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (e) {
    return NextResponse.json({ ok: false, error: `assinatura inválida: ${String((e as Error)?.message || e).slice(0, 120)}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(s.subscription));
          if (s.client_reference_id && !sub.metadata?.workspaceId) sub.metadata = { ...sub.metadata, workspaceId: s.client_reference_id };
          await syncSubscription(sub);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
        const sub = customerId ? await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } }) : null;
        if (sub && inv.id) {
          const dt = inv.created ? new Date(inv.created * 1000) : new Date();
          const comp = dt.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
          // dedup por ID da fatura do Stripe: reenvio do evento nao cria fatura duplicada
          await prisma.invoice.upsert({
            where: { stripeInvoiceId: inv.id },
            update: { valor: Math.round((inv.amount_paid || 0) / 100), status: "paga" },
            create: { workspaceId: sub.workspaceId, competencia: comp, valor: Math.round((inv.amount_paid || 0) / 100), status: "paga", vencimento: dt, stripeInvoiceId: inv.id },
          });
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 500 });
  }
}
