-- Concorrência customizável: categoria vira texto livre, canais flexíveis (JSON)
-- e categorias de concorrência criadas por workspace. Tudo additivo/idempotente.

-- 1) categoria: enum CompCategoria -> TEXT (preserva os valores existentes)
ALTER TABLE "Concorrente" ALTER COLUMN "categoria" DROP DEFAULT;
ALTER TABLE "Concorrente" ALTER COLUMN "categoria" TYPE TEXT USING "categoria"::text;
ALTER TABLE "Concorrente" ALTER COLUMN "categoria" SET DEFAULT '';

-- 2) canais flexíveis por concorrente: [{ tipo, url }]
ALTER TABLE "Concorrente" ADD COLUMN IF NOT EXISTS "canais" JSONB NOT NULL DEFAULT '[]';

-- 3) categorias de concorrência por workspace: [{ id, label }]
ALTER TABLE "EnvConfig" ADD COLUMN IF NOT EXISTS "concCategorias" JSONB NOT NULL DEFAULT '[]';
