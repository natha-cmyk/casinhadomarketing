// GET /api/zernio/dm-classify?accountId=&platform=  → classifica as DMs recentes por TIPO/intenção
// usando a LLM do workspace (BYO-LLM, igual aos agentes). Sem LLM → { disabled:true }.
// Categorias fixas; menção/resposta de story é detectada estruturalmente antes da LLM.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { resolveLlm } from "@/lib/llm";
import { listConversations, convText, type InboxConversation } from "@/lib/zernio";
import { cached } from "@/lib/ttl-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const CATEGORIAS = [
  "Interesse/produto", "Orçamento/preço", "Dúvida/suporte", "Menção em story",
  "Parceria/collab", "Elogio", "Reclamação", "Spam/irrelevante",
] as const;

// completion não-streaming (OpenAI-compat OU Anthropic) → texto puro
async function llmComplete(system: string, user: string, llm: { provider: string; apiKey: string; model: string }): Promise<string> {
  if (llm.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: llm.apiKey });
    const r = await client.messages.create({ model: llm.model || "claude-opus-5", max_tokens: 1200, system, messages: [{ role: "user", content: user }] });
    return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  }
  const bases: Record<string, { base: string; model: string }> = {
    openrouter: { base: "https://openrouter.ai/api/v1", model: "anthropic/claude-sonnet-4.5" },
    openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    gemini: { base: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash" },
  };
  const cfg = bases[llm.provider] || bases.openrouter;
  const res = await fetch(`${cfg.base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${llm.apiKey}`, "Content-Type": "application/json", "X-Title": "Casinha do Marketing" },
    body: JSON.stringify({ model: llm.model || cfg.model, max_tokens: 1200, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  const j = await res.json().catch(() => null);
  return j?.choices?.[0]?.message?.content || "";
}

// mapeia uma string livre da LLM pra uma categoria válida
function normCat(s: string): string {
  const t = (s || "").toLowerCase();
  return CATEGORIAS.find((c) => t.includes(c.toLowerCase().split("/")[0])) || "Spam/irrelevante";
}

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    const q = new URL(req.url).searchParams;
    const accountId = q.get("accountId") || undefined;
    const platform = q.get("platform") || undefined;
    if (!accountId) return NextResponse.json({ ok: true, disabled: true, message: "conta ausente" });

    const llm = await resolveLlm(ws.id);
    if (!llm) return NextResponse.json({ ok: true, disabled: true, message: "Conecte uma LLM em Personalização → Conexões pra classificar as DMs por tipo." });

    const payload = await cached(`dmclass:${ws.id}:${accountId}:${platform}`, 5 * 60_000, async () => {
      const convs = await listConversations({ accountId, platform, limit: 50 }).catch(() => [] as InboxConversation[]);
      // separa story mentions/replies (estrutural) do resto (LLM)
      const counts: Record<string, number> = {};
      const bump = (c: string) => { counts[c] = (counts[c] || 0) + 1; };
      const paraLlm: { i: number; text: string }[] = [];
      convs.forEach((c, i) => {
        if (c.isStoryMention || c.isStoryReply) { bump("Menção em story"); return; }
        const t = convText(c).trim();
        if (t) paraLlm.push({ i, text: t.slice(0, 240) });
      });

      if (paraLlm.length) {
        const system = `Você classifica mensagens de DM de Instagram/redes sociais de uma empresa em UMA categoria da lista, pela INTENÇÃO. Categorias válidas (use exatamente estas): ${CATEGORIAS.join("; ")}. Responda SOMENTE um array JSON de strings, uma categoria por mensagem, na MESMA ORDEM e QUANTIDADE. Sem texto extra.`;
        const user = paraLlm.map((m, idx) => `${idx + 1}. ${m.text}`).join("\n");
        const out = await llmComplete(system, user, llm).catch(() => "");
        let arr: string[] = [];
        try { const m = out.match(/\[[\s\S]*\]/); arr = m ? JSON.parse(m[0]) : []; } catch { arr = []; }
        paraLlm.forEach((_, idx) => bump(normCat(arr[idx] || "")));
      }

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const categorias = CATEGORIAS.map((c) => ({ categoria: c, count: counts[c] || 0 })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count);
      return { total, categorias, analisadas: convs.length };
    });

    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 200) }, { status: 502 });
  }
}
