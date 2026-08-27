-- Dedup de faturas: 1 fatura do Stripe = 1 registro (evita duplicar quando o webhook reenvia o evento invoice.paid).
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");
