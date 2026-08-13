-- Persona v2: campos profundos (persona como pessoa real).
-- { nomeProprio, consome[], gosta[], naoGosta[], atividades[] } em JSONB.

ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "detalhes" JSONB NOT NULL DEFAULT '{}';
