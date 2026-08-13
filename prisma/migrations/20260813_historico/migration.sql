-- Importador de histórico: totais mensais das planilhas antigas (pré-90 dias)
-- que a integração ao vivo não puxa. Uma célula por (plataforma × métrica × ano × mês).

-- CreateTable
CREATE TABLE IF NOT EXISTS "HistoricalMetric" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HistoricalMetric_workspaceId_platform_idx" ON "HistoricalMetric"("workspaceId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HistoricalMetric_workspaceId_platform_metric_ano_mes_key" ON "HistoricalMetric"("workspaceId", "platform", "metric", "ano", "mes");

-- AddForeignKey
ALTER TABLE "HistoricalMetric" ADD CONSTRAINT "HistoricalMetric_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
