// Resolve qual LLM usar para os agentes de um workspace (server-only).
// Prioridade: chave do PRÓPRIO workspace (BYO-LLM) → chave da agência (env, só teste) → nenhuma.
// Sem nenhuma → os agentes caem no "modo mínimo" (sem análise profunda).
import { prisma } from "./prisma";

export const LLM_PROVIDERS = ["openrouter", "anthropic", "openai", "gemini"] as const;

export interface ResolvedLlm {
  provider: string; // openrouter | anthropic | openai | gemini
  apiKey: string;
  model: string;
  source: "workspace" | "agency";
}

export async function resolveLlm(workspaceId: string): Promise<ResolvedLlm | null> {
  const cfg = await prisma.llmConfig.findUnique({ where: { workspaceId } }).catch(() => null);
  if (cfg?.apiKey) {
    return {
      provider: (LLM_PROVIDERS as readonly string[]).includes(cfg.provider) ? cfg.provider : "openrouter",
      apiKey: cfg.apiKey,
      model: cfg.model || "",
      source: "workspace",
    };
  }
  // fallback da agência (env) — só pra testes/uso interno
  if (process.env.OPENROUTER_API_KEY) {
    return { provider: "openrouter", apiKey: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || "", source: "agency" };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_MODEL || "", source: "agency" };
  }
  return null;
}
