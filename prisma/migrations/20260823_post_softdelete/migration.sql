-- Lixeira: soft-delete restaurável (purga automática após 7 dias).
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Post_deletedAt_idx" ON "Post"("deletedAt");
