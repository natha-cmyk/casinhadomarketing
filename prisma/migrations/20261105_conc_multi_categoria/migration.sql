-- Concorrente em múltiplas categorias. Aditivo e idempotente (DB staging/prod compartilhado).
-- Mantém a coluna `categoria` (1ª categoria) p/ compat com código antigo na outra branch.

-- 1) nova coluna: array de ids de categoria
ALTER TABLE "Concorrente" ADD COLUMN IF NOT EXISTS "categorias" JSONB NOT NULL DEFAULT '[]';

-- 2) backfill: concorrentes com categoria única viram array de 1 elemento
UPDATE "Concorrente"
   SET "categorias" = to_jsonb(ARRAY["categoria"])
 WHERE "categoria" <> ''
   AND ("categorias" IS NULL OR "categorias" = '[]'::jsonb);
