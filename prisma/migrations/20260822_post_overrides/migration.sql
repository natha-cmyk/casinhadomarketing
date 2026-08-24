-- Ajustes por canal na publicação (legenda específica por rede): { redeId: { caption } }.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "overrides" JSONB NOT NULL DEFAULT '{}';
