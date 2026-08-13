-- CRM: Geração por Canais (config de conexão + leads/oportunidades)

-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmConfig" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'clickup',
    "clickupToken" TEXT,
    "clickupListId" TEXT,
    "fieldMap" JSONB NOT NULL DEFAULT '{}',
    "webhookSecret" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Lead" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "extId" TEXT,
    "title" TEXT,
    "source" TEXT,
    "channel" TEXT,
    "product" TEXT,
    "status" TEXT,
    "stage" TEXT,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lossReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConfig_workspaceId_key" ON "CrmConfig"("workspaceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Lead_workspaceId_idx" ON "Lead"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_workspaceId_extId_key" ON "Lead"("workspaceId", "extId");

-- AddForeignKey
ALTER TABLE "CrmConfig" ADD CONSTRAINT "CrmConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
