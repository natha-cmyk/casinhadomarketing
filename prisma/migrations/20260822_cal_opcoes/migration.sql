-- Opções custom do calendário criadas na hora: { pilares?: string[], formatos?: string[] }.
ALTER TABLE "EnvConfig" ADD COLUMN IF NOT EXISTS "calOpcoes" JSONB NOT NULL DEFAULT '{}';
