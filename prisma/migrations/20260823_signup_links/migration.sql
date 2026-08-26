-- Links de cadastro personalizados (plano + trial) gerados pelo admin.
CREATE TABLE IF NOT EXISTS "SignupLink" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "plano" TEXT NOT NULL DEFAULT 'mensal',
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "criadoPor" TEXT NOT NULL DEFAULT '',
  "usadoPorEmail" TEXT,
  "usadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignupLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SignupLink_token_key" ON "SignupLink"("token");
CREATE INDEX IF NOT EXISTS "SignupLink_token_idx" ON "SignupLink"("token");
