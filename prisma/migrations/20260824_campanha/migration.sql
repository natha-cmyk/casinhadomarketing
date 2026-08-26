-- Campanha nos links de cadastro (nome da ação) + rastreio de origem no workspace.
ALTER TABLE "SignupLink" ADD COLUMN IF NOT EXISTS "nomeAcao" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "origem" TEXT;
