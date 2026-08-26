// Helpers de checkout Stripe (server-only): garante Customer do workspace e cria a
// sessão de Checkout hospedada. Reusado pela rota do cliente e pela do admin (com trial).
import { stripe, PRICES, planoFromPrice, type Plano } from "./stripe";
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

// Abre uma assinatura EM TRIAL (sem exigir cartão agora). No fim do trial, se não houver
// forma de pagamento, o Stripe PAUSA a assinatura (o cliente adiciona o cartão pra continuar).
// Usado quando a pessoa conclui o cadastro por um link personalizado com trial.
export async function startTrial(opts: { workspaceId: string; email?: string; plano: Plano; trialDays: number }): Promise<{ ok: boolean; error?: string; trialEnd?: Date }> {
  if (!stripe) return { ok: false, error: "stripe não configurado" };
  const price = PRICES[opts.plano];
  if (!price) return { ok: false, error: `preço não configurado para ${opts.plano}` };
  const customer = await ensureCustomer(opts.workspaceId, opts.email);
  if (!customer) return { ok: false, error: "sem customer" };
  const sub = await stripe.subscriptions.create({
    customer,
    items: [{ price }],
    trial_period_days: Math.max(1, opts.trialDays),
    trial_settings: { end_behavior: { missing_payment_method: "pause" } },
    metadata: { workspaceId: opts.workspaceId },
  });
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  await prisma.subscription.upsert({
    where: { workspaceId: opts.workspaceId },
    create: { workspaceId: opts.workspaceId, stripeCustomerId: customer, stripeSubscriptionId: sub.id, stripePriceId: price, plano: opts.plano, status: "trial", trialEnd, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, proximaCobranca: trialEnd },
    update: { stripeSubscriptionId: sub.id, stripePriceId: price, plano: planoFromPrice(price) || opts.plano, status: "trial", trialEnd, currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null, proximaCobranca: trialEnd },
  });
  return { ok: true, trialEnd: trialEnd || undefined };
}
