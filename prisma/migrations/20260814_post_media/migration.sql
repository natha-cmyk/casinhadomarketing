-- Mídia do post (agendamento real via Zernio presign).
-- Array de MediaItem: [{ type, url, filename, mimeType, size? }].

ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "media" JSONB NOT NULL DEFAULT '[]';
