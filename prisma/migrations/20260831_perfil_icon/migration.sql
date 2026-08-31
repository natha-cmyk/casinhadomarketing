-- Icone da empresa (quadradinho da sidebar): pronto (iconUrl) ou gerado da logo + cor de fundo (iconBg).
ALTER TABLE "Perfil" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE "Perfil" ADD COLUMN IF NOT EXISTS "iconBg" TEXT;
