// Stripe (server-only). Env-gated: sem STRIPE_SECRET_KEY, stripe = null e stripeConfigured()
// = false → o billing manual (Admin → Financeiro) segue como fallback, nada quebra.
//   STRIPE_SECRET_KEY            — sk_test_… (teste) ou sk_live_… (produção)
//   STRIPE_WEBHOOK_SECRET        — whsec_… (assinatura do webhook)
//   STRIPE_PRICE_MENSAL          — price_… (R$500/mês, recorrente mensal)
//   STRIPE_PRICE_ANUAL_PARCELADO — price_… (R$420/mês, recorrente mensal — "anual parcelado 12×")
//   STRIPE_PRICE_ANUAL_AVISTA    — price_… (R$4.788/ano, recorrente anual — 5% off)
import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY || "";
export const stripeConfigured = () => !!KEY;
export const stripe: Stripe | null = KEY ? new Stripe(KEY) : null;

export type Plano = "mensal" | "anual_parcelado" | "anual_avista";

export const PRICES: Record<Plano, string | undefined> = {
  mensal: process.env.STRIPE_PRICE_MENSAL,
  anual_parcelado: process.env.STRIPE_PRICE_ANUAL_PARCELADO,
  anual_avista: process.env.STRIPE_PRICE_ANUAL_AVISTA,
};

export const PLANO_LABEL: Record<Plano, string> = {
  mensal: "Mensal (R$500/mês)",
  anual_parcelado: "Anual parcelado (12× R$420)",
  anual_avista: "Anual à vista (R$4.788, 5% off)",
};

// price id do Stripe → nosso plano (pra sincronizar via webhook)
export function planoFromPrice(priceId?: string | null): Plano | null {
  if (!priceId) return null;
  for (const p of Object.keys(PRICES) as Plano[]) if (PRICES[p] === priceId) return p;
  return null;
}
