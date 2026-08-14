-- Audit log: eventos (quem fez o quê) por workspace.
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "actor" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL,
  "target" TEXT NOT NULL DEFAULT '',
  "meta" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Event_workspaceId_createdAt_idx" ON "Event"("workspaceId","createdAt");
