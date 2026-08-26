// Sincroniza uma assinatura do Stripe → nossa tabela Subscription (chamado pelo webhook).
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { planoFromPrice } from "./stripe";

const STATUS_MAP: Record<string, string> = {
  active: "ativa",
  trialing: "trial",
  past_due: "inadimplente",
  unpaid: "inadimplente",
  canceled: "cancelada",
  paused: "pausada",
  incomplete: "pausada",
  incomplete_expired: "cancelada",
};

export async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const workspaceId = (sub.metadata?.workspaceId as string) || "";
  const priceId = sub.items.data[0]?.price?.id || null;
  const plano = planoFromPrice(priceId);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  const data = {
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: STATUS_MAP[sub.status] || "ativa",
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    proximaCobranca: periodEnd ? new Date(periodEnd * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    ...(plano ? { plano } : {}),
  };
  if (workspaceId) {
    await prisma.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
    return;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const existing = await prisma.subscription.findFirst({ where: { stripeCustomerId: customerId } });
  if (existing) await prisma.subscription.update({ where: { id: existing.id }, data });
}
