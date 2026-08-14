// POST /api/agents/chat — conversa com um Assistente do Panteão (LLM real via Claude).
// Body: { agentKey, messages:[{role:"user"|"bot", text}], scope:{period,year,month,week,quarter} }
// Resposta: stream de texto puro (text/plain) OU, se a chave de LLM não estiver
// configurada, JSON { disabled:true, message } — o painel degrada com elegância.
// Chave centralizada na agência via ANTHROPIC_API_KEY (igual à integração social).
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveWorkspace } from "@/lib/auth";
import { AGENTS, buildContext, normalizeScope, type AgentKey } from "@/lib/agents";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  agentKey?: string;
  messages?: { role?: string; text?: string }[];
  scope?: { period?: string; year?: number; month?: number; week?: number; quarter?: number };
}

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const agentKey = body.agentKey as AgentKey;
  const agent = AGENTS[agentKey];
  if (!agent) return NextResponse.json({ error: "agente inválido" }, { status: 400 });

  // seam de LLM: sem chave, ainda respondemos (mock explícito) sem quebrar a UI
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      disabled: true,
      message: `${agent.nome} está pronto, mas a chave de LLM ainda não foi configurada neste ambiente. Assim que a agência conectar a LLM, eu respondo com os dados reais do seu workspace.`,
    });
  }

  const scope = normalizeScope(body.scope);
  const context = await buildContext(agentKey, ws, scope).catch(() => "Contexto indisponível no momento.");

  const history = (body.messages || [])
    .filter((m) => (m.text || "").trim())
    .map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: String(m.text),
    }));
  // a conversa precisa começar por 'user'
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return NextResponse.json({ error: "sem mensagem" }, { status: 400 });

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";
  const system = `${agent.system}\n\n=== CONTEXTO DO WORKSPACE (dados reais) ===\n${context}\n=== FIM DO CONTEXTO ===`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const s = client.messages.stream({
          model,
          max_tokens: 1500,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system,
          messages: history,
        });
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode(`\n\n[não consegui gerar a resposta agora: ${String(e).slice(0, 120)}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
