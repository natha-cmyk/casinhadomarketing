"use client";
// Conexão de LLM do workspace (BYO-LLM), embutida no dock dos agentes. Sem LLM os agentes
// respondem só o básico; com LLM (OpenRouter/Anthropic) rodam a análise completa.
import { useEffect, useState } from "react";

interface Status { connected: boolean; provider: string; model: string; agencyFallback: boolean }

export function AgentLlmConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("openrouter");
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents/llm").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  const save = async () => {
    if (!key.trim() || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/agents/llm", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key, model }),
      });
      const j = await r.json().catch(() => null);
      setBusy(false);
      if (r.ok && j?.ok) { setStatus((s) => ({ connected: true, provider, model, agencyFallback: s?.agencyFallback ?? false })); setKey(""); setOpen(false); }
      else setMsg(j?.error || "Falha ao salvar.");
    } catch { setBusy(false); setMsg("Erro de rede."); }
  };
  const remove = async () => {
    await fetch("/api/agents/llm", { method: "DELETE" }).catch(() => {});
    setStatus((s) => (s ? { ...s, connected: false } : s));
  };

  const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--hairline)", borderRadius: 8, padding: "7px 9px", font: "inherit", fontSize: 12, outline: "none", background: "#fff" };

  if (!status) return null;

  return (
    <div style={{ borderTop: "1px solid var(--hairline)", padding: "8px 12px" }}>
      {status.connected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--label-3)" }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--excelente,#2FB457)" }} />
          LLM conectada ({status.provider})
          <button onClick={() => setOpen((v) => !v)} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--cyan)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>trocar</button>
          <button onClick={remove} style={{ border: 0, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 11 }}>remover</button>
        </div>
      ) : (
        <button onClick={() => setOpen((v) => !v)} style={{ width: "100%", textAlign: "left", border: 0, background: "transparent", cursor: "pointer", fontSize: 11.5, fontWeight: 600, color: "var(--cyan)" }}>
          ⚡ Conectar sua LLM pra análise completa
        </button>
      )}

      {open && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={inp}>
            <option value="openrouter">OpenRouter (recomendado)</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua API key" autoComplete="off" style={inp} />
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={provider === "openrouter" ? "modelo (opcional, ex. anthropic/claude-sonnet-4.5)" : "modelo (opcional, ex. claude-opus-5)"} style={inp} />
          {msg && <div style={{ fontSize: 11, color: "var(--red)" }}>{msg}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={save} disabled={busy || !key.trim()} style={{ border: 0, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: busy || !key.trim() ? "default" : "pointer", background: key.trim() ? "var(--ink)" : "var(--hairline)", color: key.trim() ? "#fff" : "var(--label-3)" }}>
              {busy ? "Salvando…" : "Salvar"}
            </button>
            <a href={provider === "openrouter" ? "https://openrouter.ai/keys" : "https://console.anthropic.com/settings/keys"} target="_blank" rel="noopener" style={{ fontSize: 11, color: "var(--label-3)" }}>onde pego a chave?</a>
          </div>
        </div>
      )}
    </div>
  );
}
