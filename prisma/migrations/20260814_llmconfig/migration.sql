-- BYO-LLM: chave de LLM por workspace (OpenRouter/Anthropic).
CREATE TABLE IF NOT EXISTS "LlmConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL UNIQUE REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'openrouter',
  "apiKey" TEXT NOT NULL,
  "model" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL
);
