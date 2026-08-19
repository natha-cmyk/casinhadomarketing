CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "plano" TEXT NOT NULL DEFAULT 'mensal',
  "valorMensal" INTEGER NOT NULL DEFAULT 500,
  "valorAnualMes" INTEGER NOT NULL DEFAULT 420,
  "proximaCobranca" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ativa',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "competencia" TEXT NOT NULL,
  "valor" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'aberta',
  "vencimento" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Invoice_workspaceId_idx" ON "Invoice"("workspaceId");

CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "cliente" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'convidado',
  "abonouMes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Referral_workspaceId_idx" ON "Referral"("workspaceId");
