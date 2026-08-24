-- Perfil padrão por canal (multiconta) no calendário: { redeId: "nome do perfil" }.
ALTER TABLE "EnvConfig" ADD COLUMN IF NOT EXISTS "calDefaults" JSONB NOT NULL DEFAULT '{}';
