-- Stripe na Subscription (campos opcionais; nulo = controle manual).
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "trialEnd" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
