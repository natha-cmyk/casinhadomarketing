// /api/agents/llm — conexão de LLM do workspace (BYO-LLM). GET status (sem a chave),
// POST salva, DELETE remove. Escopado por workspace ativo.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { LLM_PROVIDERS } from "@/lib/llm";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<string>(LLM_PROVIDERS);

export async function GET() {
  const wsId = await getActiveWorkspaceId();
  if (!wsId) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const cfg = await prisma.llmConfig.findUnique({ where: { workspaceId: wsId } }).catch(() => null);
  const agencyFallback = !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
  return NextResponse.json({
    connected: !!cfg?.apiKey,
    provider: cfg?.provider || "openrouter",
    model: cfg?.model || "",
    agencyFallback, // se true, os agentes ainda rodam pela chave da agência mesmo sem a do workspace
  });
}

export async function POST(req: Request) {
  const wsId = await getActiveWorkspaceId();
  if (!wsId) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { provider?: string; apiKey?: string; model?: string };
  const provider = PROVIDERS.has(String(b.provider)) ? String(b.provider) : "openrouter";
  const apiKey = (b.apiKey || "").trim();
  const model = (b.model || "").trim();
  if (!apiKey) return NextResponse.json({ error: "Cole a sua chave de LLM." }, { status: 400 });
  try {
    await prisma.llmConfig.upsert({
      where: { workspaceId: wsId },
      create: { workspaceId: wsId, provider, apiKey, model },
      update: { provider, apiKey, model },
    });
    await logEvent(wsId, "llm.connected", provider);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function DELETE() {
  const wsId = await getActiveWorkspaceId();
  if (!wsId) return NextResponse.json({ error: "unauth" }, { status: 401 });
  await prisma.llmConfig.deleteMany({ where: { workspaceId: wsId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
