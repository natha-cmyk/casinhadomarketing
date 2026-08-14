// POST /api/agents/chat — conversa com um Assistente do Panteão (LLM real).
// Body: { agentKey, messages:[{role:"user"|"bot", text}], scope:{period,year,month,week,quarter} }
// Resposta: stream de texto puro (text/plain) OU, se não houver chave de LLM,
// JSON { disabled:true, message } — o painel degrada com elegância.
//
// Backend de LLM (chave centralizada na agência):
//   1) OPENROUTER_API_KEY → OpenRouter (1 chave, vários modelos; slug via OPENROUTER_MODEL)
//   2) ANTHROPIC_API_KEY  → Anthropic direto (model via ANTHROPIC_MODEL)
// Marca: sempre "LLM" na UI. Modelo Claude por padrão (CLAUDE.md).
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { AGENTS, buildContext, normalizeScope, type AgentKey } from "@/lib/agents";
import { resolveLlm } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // Pro + Fluid Compute permite streaming longo da LLM

interface Body {
  agentKey?: string;
  messages?: { role?: string; text?: string }[];
  scope?: { period?: string; year?: number; month?: number; week?: number; quarter?: number };
  accounts?: import("@/lib/agents").AccountLite[]; // contas já carregadas no client (sem custo de integração)
  panel?: unknown; // snapshot do que o painel está exibindo (fonte primária dos números ao vivo)
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

// ── OpenRouter (OpenAI-compatible /chat/completions, streaming SSE) ───────────
async function streamOpenRouter(system: string, history: Msg[], apiKey: string, modelIn: string): Promise<ReadableStream<Uint8Array>> {
  const model = modelIn || "anthropic/claude-sonnet-4.5";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Casinha do Marketing",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 1500,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  const encoder = new TextEncoder();
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    return new ReadableStream({
      start(c) { c.enqueue(encoder.encode(`[erro do LLM ${res.status}: ${body.slice(0, 140)}]`)); c.close(); },
    });
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) { controller.close(); return; }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (data === "[DONE]") { controller.close(); return; }
        try {
          const j = JSON.parse(data);
          const delta = j?.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        } catch { /* keep-alive / parcial — ignora */ }
      }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
}

// ── Anthropic direto ─────────────────────────────────────────────────────────
async function streamAnthropic(system: string, history: Msg[], apiKey: string, modelIn: string): Promise<ReadableStream<Uint8Array>> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const model = modelIn || "claude-opus-5";
  const messages = history.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })) as { role: "user" | "assistant"; content: string }[];
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const s = client.messages.stream({
          model, max_tokens: 1500,
          thinking: { type: "adaptive" }, output_config: { effort: "low" },
          system, messages,
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
}

export async function POST(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const agentKey = body.agentKey as AgentKey;
  const agent = AGENTS[agentKey];
  if (!agent) return NextResponse.json({ error: "agente inválido" }, { status: 400 });

  // BYO-LLM: chave do próprio workspace → fallback agência → modo mínimo (sem LLM)
  const llm = await resolveLlm(ws.id);
  if (!llm) {
    return NextResponse.json({
      disabled: true,
      message: `Sou o ${agent.nome}. Pra eu analisar de verdade os dados do seu workspace, conecte sua LLM em Personalização → Conexões (ex.: OpenRouter). Sem ela eu respondo só o básico — com ela, desbloqueio a análise completa de desempenho, mídia paga e conteúdo.`,
    });
  }

  const scope = normalizeScope(body.scope);
  const context = await buildContext(agentKey, ws, scope, {
    accounts: Array.isArray(body.accounts) ? body.accounts.slice(0, 40) : [],
    panel: body.panel,
  }).catch(() => "Contexto indisponível no momento.");
  const system = `${agent.system}\n\n=== CONTEXTO DO WORKSPACE (dados reais) ===\n${context}\n=== FIM DO CONTEXTO ===`;

  const history: Msg[] = (body.messages || [])
    .filter((m) => (m.text || "").trim())
    .map((m) => ({ role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant", content: String(m.text) }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return NextResponse.json({ error: "sem mensagem" }, { status: 400 });

  const stream = llm.provider === "anthropic"
    ? await streamAnthropic(system, history, llm.apiKey, llm.model)
    : await streamOpenRouter(system, history, llm.apiKey, llm.model);
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
