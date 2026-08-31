-- Logo da empresa (aparece no topo da sidebar). Aditivo, nao destrutivo.
ALTER TABLE "Perfil" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
