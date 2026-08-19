CREATE TABLE IF NOT EXISTS "Invite" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'member',
  "invitedBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Invite_workspaceId_idx" ON "Invite"("workspaceId");
CREATE INDEX IF NOT EXISTS "Invite_email_idx" ON "Invite"("email");
