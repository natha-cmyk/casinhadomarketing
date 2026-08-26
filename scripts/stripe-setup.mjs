// Cria o produto + os 3 preços da Casinha no Stripe e imprime os IDs pra por na Vercel.
// Rodar UMA vez (em teste): STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
// Depois cole as 3 linhas STRIPE_PRICE_* nas Environment Variables da Vercel.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Defina STRIPE_SECRET_KEY (sk_test_... pra teste)."); process.exit(1); }
const stripe = new Stripe(key);

const product = await stripe.products.create({ name: "Casinha do Marketing — Assinatura" });

const mk = (unit_amount, interval, nickname) =>
  stripe.prices.create({ product: product.id, currency: "brl", unit_amount, recurring: { interval }, nickname });

const mensal = await mk(50000, "month", "Mensal R$500");
const parcelado = await mk(42000, "month", "Anual parcelado 12x R$420");
const avista = await mk(478800, "year", "Anual a vista R$4.788 (5% off)");

console.log("\n== Cole na Vercel (Environment Variables) ==");
console.log("STRIPE_PRICE_MENSAL=" + mensal.id);
console.log("STRIPE_PRICE_ANUAL_PARCELADO=" + parcelado.id);
console.log("STRIPE_PRICE_ANUAL_AVISTA=" + avista.id);
console.log("\nProduto:", product.id, `(modo ${key.startsWith("sk_live") ? "PRODUÇÃO" : "TESTE"})`);
