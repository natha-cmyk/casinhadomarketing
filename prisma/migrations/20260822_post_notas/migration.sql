-- Campos de produção no Post: notas internas, link de referência e link do roteiro.
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "notas" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "linkRef" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "roteiro" TEXT NOT NULL DEFAULT '';
