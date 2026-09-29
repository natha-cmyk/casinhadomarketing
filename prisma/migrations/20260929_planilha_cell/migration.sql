-- Célula da PLANILHA ANUAL (overview): histórico importado + preenchimento manual do cliente.
-- Cobre semanas (semana 0-3) e total do mês (semana -1), além de valores de texto.
CREATE TABLE IF NOT EXISTS "PlanilhaCell" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "tab"         TEXT NOT NULL,
  "metric"      TEXT NOT NULL,
  "ano"         INTEGER NOT NULL,
  "mes"         INTEGER NOT NULL,
  "semana"      INTEGER NOT NULL DEFAULT -1,
  "valor"       DOUBLE PRECISION,
  "texto"       TEXT,
  "source"      TEXT NOT NULL DEFAULT 'manual',
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanilhaCell_ws_tab_metric_ano_mes_semana_key"
  ON "PlanilhaCell"("workspaceId","tab","metric","ano","mes","semana");
CREATE INDEX IF NOT EXISTS "PlanilhaCell_ws_tab_ano_idx"
  ON "PlanilhaCell"("workspaceId","tab","ano");
