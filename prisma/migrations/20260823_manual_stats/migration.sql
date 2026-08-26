-- Indicadores manuais por canal (ex.: contagem de Stories do Instagram, que a API não expõe).
ALTER TABLE "EnvConfig" ADD COLUMN IF NOT EXISTS "manualStats" JSONB NOT NULL DEFAULT '{}';
