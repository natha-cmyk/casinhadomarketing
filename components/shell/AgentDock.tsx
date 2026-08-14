"use client";
// Bolha de agentes — troca por seção, sugestões contextuais, LLM real.
// Cada envio chama /api/agents/chat (streaming), com o período da toolbar como escopo.
// Sem ANTHROPIC_API_KEY o endpoint devolve um aviso amigável (não quebra).
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { viewForPath } from "@/lib/nav";
import { Ic } from "../Ic";

interface Agent { nome: string; papel: string; cor: string; ini: string; intro: string; sugestoes: string[] }
const AGENTS: Record<string, Agent> = {
  poseidon: { nome: "Poseidon", papel: "Dados & mídia paga", cor: "#00BBC5", ini: "Po", intro: "Sou o Poseidon. Leio seus painéis e a mídia paga — me pergunte sobre performance, ROAS, frequência e custo por conversa.", sugestoes: ["Analise o ROAS do mês", "Onde estou perdendo eficiência?", "Resumo rápido do painel"] },
  apollo: { nome: "Apollo", papel: "Conteúdo & canais", cor: "#FF001E", ini: "Ap", intro: "Sou o Apollo. Cuido de conteúdo e calendário — me peça pautas, roteiros, legendas e ideias por canal.", sugestoes: ["Sugira 3 posts pra esta semana", "Escreva uma legenda pra um Reels", "O que postar no LinkedIn?"] },
  athena: { nome: "Athena", papel: "Metas & OKR", cor: "#8E5BE0", ini: "At", intro: "Sou a Athena. Acompanho suas metas e OKR — me pergunte sobre progresso, prioridades e o que destravar.", sugestoes: ["Como estão os KRs de marketing?", "O que priorizar este mês?", "Estou no ritmo da meta de leads?"] },
  dionisio: { nome: "Dionísio", papel: "Persona & público", cor: "#FF9F0A", ini: "Di", intro: "Sou o Dionísio. Entendo seu público e o CRM — me pergunte sobre personas, segmentos e conversão.", sugestoes: ["Qual persona converte mais?", "Sugira um segmento pra reativar", "Onde está o gargalo do funil?"] },
};
const AGENT_BY_VIEW: Record<string, keyof typeof AGENTS> = {
  overview: "poseidon", ads: "poseidon", canais: "poseidon", concorrencia: "poseidon", config: "poseidon",
  calendario: "apollo", instagram: "apollo", tiktok: "apollo", linkedin: "apollo", youtube: "apollo",
  x: "apollo", facebook: "apollo", threads: "apollo", reddit: "apollo", pinterest: "apollo",
  bluesky: "apollo", snapchat: "apollo", googlebusiness: "apollo",
  metas: "athena", persona: "dionisio",
};

export function AgentDock() {
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const key = (AGENT_BY_VIEW[view] || "poseidon") as string;
  const a = AGENTS[key];
  const open = useStore((s) => s.agentOpen);
  const toggle = useStore((s) => s.toggleAgent);
  const msgs = useStore((s) => s.agentMsgs[key]) || [];
  const push = useStore((s) => s.agentPush);
  const setLast = useStore((s) => s.agentSetLast);
  // escopo temporal (toolbar) — enviado ao agente pra ancorar a análise no período
  const period = useStore((s) => s.period);
  const year = useStore((s) => s.year);
  const month = useStore((s) => s.month);
  const week = useStore((s) => s.week);
  const quarter = useStore((s) => s.quarter);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [msgs, open]);

  const send = async (t: string) => {
    const v = (t || "").trim();
    if (!v || busy) return;
    setText("");
    push(key, { role: "user", text: v });
    // histórico ANTES do placeholder do bot (inclui a mensagem recém-enviada)
    const history = useStore.getState().agentMsgs[key] || [];
    push(key, { role: "bot", text: "" });
    setBusy(true);
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentKey: key, messages: history, scope: { period, year, month, week, quarter } }),
      });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        setLast(key, j.message || j.error || "Sem resposta.");
      } else if (res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setLast(key, acc);
        }
        if (!acc) setLast(key, "(sem resposta)");
      } else {
        setLast(key, "(sem resposta)");
      }
    } catch {
      setLast(key, "Não consegui responder agora. Tente de novo em instantes.");
    } finally {
      setBusy(false);
    }
  };

  const av = (
    <div className="ag-av" style={{ background: a.cor }}>
      {a.ini}
    </div>
  );

  return (
    <div id="agentDock">
      {open && (
        <div className="ag-panel">
          <div className="ag-head">
            <div className="ag-head-l">
              {av}
              <div>
                <b>{a.nome}</b>
                <span>{a.papel}</span>
              </div>
            </div>
            <button className="ag-x" onClick={toggle} aria-label="Fechar" type="button">
              ✕
            </button>
          </div>
          <div className="ag-thread" ref={threadRef}>
            <div className="ag-msg ag-bot">
              {av}
              <div className="ag-bubble">{a.intro}</div>
            </div>
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div className="ag-msg ag-user" key={i}>
                  <div className="ag-bubble">{m.text}</div>
                </div>
              ) : (
                <div className="ag-msg ag-bot" key={i}>
                  {av}
                  <div className="ag-bubble">{m.text || (busy && i === msgs.length - 1 ? "…" : m.text)}</div>
                </div>
              )
            )}
            {msgs.length === 0 && (
              <div className="ag-sugg">
                {a.sugestoes.map((s) => (
                  <button className="ag-chip" key={s} onClick={() => send(s)} type="button">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ag-input">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(text)}
              placeholder={busy ? `${a.nome} está pensando…` : `Pergunte ao ${a.nome}…`}
              autoComplete="off"
              disabled={busy}
            />
            <button onClick={() => send(text)} aria-label="Enviar" type="button" disabled={busy}>
              <Ic name="upload" />
            </button>
          </div>
          <div className="ag-foot">Assistente com LLM · lê os dados do seu workspace no período selecionado</div>
        </div>
      )}
      <button
        className={`ag-fab${open ? " open" : ""}`}
        style={{ "--agc": a.cor } as React.CSSProperties}
        onClick={toggle}
        aria-label={`Assistente ${a.nome}`}
        type="button"
      >
        {open ? "✕" : a.ini}
      </button>
    </div>
  );
}
