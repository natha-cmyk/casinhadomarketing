-- Cache persistente de analytics de período FECHADO (imutável). Sobrevive a reinício do servidor.
CREATE TABLE IF NOT EXISTS "AnalyticsCache" (
  "key"       TEXT NOT NULL PRIMARY KEY,
  "payload"   JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AnalyticsCache_createdAt_idx" ON "AnalyticsCache"("createdAt");
