-- Mídia paga manual + indicadores customizados por perfil
ALTER TABLE "EnvConfig" ADD COLUMN IF NOT EXISTS "adConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "EnvConfig" ADD COLUMN IF NOT EXISTS "customInd" JSONB NOT NULL DEFAULT '{}';
