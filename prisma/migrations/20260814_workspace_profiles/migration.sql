-- Multi-profile por workspace (multi-conta): a integração limita 1 conta/rede por profile.
CREATE TABLE IF NOT EXISTS "WorkspaceProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "zernioProfileId" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WorkspaceProfile_workspaceId_idx" ON "WorkspaceProfile"("workspaceId");
-- backfill: registra o profile primário existente de cada workspace
INSERT INTO "WorkspaceProfile" ("id","workspaceId","zernioProfileId","label","createdAt")
SELECT gen_random_uuid()::text, "id", "zernioProfileId", 'primário', now()
FROM "Workspace" WHERE "zernioProfileId" IS NOT NULL
ON CONFLICT ("zernioProfileId") DO NOTHING;
