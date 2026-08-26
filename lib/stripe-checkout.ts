// Helpers de checkout Stripe (server-only): garante Customer do workspace e cria a
// sessão de Checkout hospedada. Reusado pela rota do cliente e pela do admin (com trial).
import { stripe, PRICES, type Plano } from "./stripe";
import { prisma } from "./prisma";
import { APP_URL } from "./email";

export async function ensureCustomer(workspaceId: string, email?: string): Promise<string | null> {
  if (!stripe) return null;
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (sub?.stripeCustomerId) return sub.stripeCustomerId;
  const c = await stripe.customers.create({ email: email || undefined, metadata: { workspaceId } });
  await prisma.subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, stripeCustomerId: c.id },
    update: { stripeCustomerId: c.id },
  });
  return c.id;
}

export async function createCheckout(opts: { workspaceId: string; email?: string; plano: Plano; trialDays?: number }): Promise<string | null> {
  if (!stripe) return null;
  const price = PRICES[opts.plano];
  if (!price) throw new Error(`Preço não configurado para o plano ${opts.plano}. Rode o scripts/stripe-setup.mjs e configure as env STRIPE_PRICE_*.`);
  const customer = await ensureCustomer(opts.workspaceId, opts.email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customer || undefined,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: opts.workspaceId,
    subscription_data: {
      metadata: { workspaceId: opts.workspaceId },
      ...(opts.trialDays ? { trial_period_days: opts.trialDays } : {}),
    },
    allow_promotion_codes: true,
    success_url: `${APP_URL}/assinatura?status=sucesso`,
    cancel_url: `${APP_URL}/assinatura?status=cancelado`,
  });
  return session.url;
}
