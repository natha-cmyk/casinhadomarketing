"use client";
// Bolha de agentes — troca por seção, sugestões contextuais, LLM real.
// Cada envio chama /api/agents/chat (streaming), com o período da toolbar como escopo.
// Sem ANTHROPIC_API_KEY o endpoint devolve um aviso amigável (não quebra).
import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { viewForPath } from "@/lib/nav";
import { agentVisibleOn, panelOfView, agentDisplayName } from "@/lib/agents-meta";
import { Ic } from "../Ic";
import { AgentMarkdown } from "./AgentMarkdown";
import { AgentLlmConnect } from "./AgentLlmConnect";

// markdown → HTML simples (só p/ exportar PDF via janela de impressão)
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inl = (s: string) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  const lines = (md || "").replace(/\r/g, "").split("\n");
  const out: string[] = []; let list: string[] | null = null; let para: string[] = [];
  const fp = () => { if (para.length) { out.push(`<p>${inl(para.join(" "))}</p>`); para = []; } };
  const fl = () => { if (list) { out.push(`<ul>${list.map((i) => `<li>${inl(i)}</li>`).join("")}</ul>`); list = null; } };
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { fp(); fl(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    const li = /^(?:[-*]|\d+[.)])\s+(.*)$/.exec(t);
    if (h) { fp(); fl(); const lvl = Math.min(h[1].length, 3) + 2; out.push(`<h${lvl}>${inl(h[2])}</h${lvl}>`); }
    else if (li) { fp(); if (!list) list = []; list.push(li[1]); }
    else { fl(); para.push(t); }
  }
  fp(); fl();
  return out.join("\n");
}

interface Agent { nome: string; papel: string; cor: string; ini: string; icon: string; intro: string; sugestoes: string[] }
const AGENTS: Record<string, Agent> = {
  poseidon: { nome: "Poseidon", papel: "Performance, tráfego pago & dados", cor: "#00BBC5", ini: "Po", icon: "ag_data", intro: "Sou o Poseidon Jackson — performance, tráfego pago e dados. Leio funil e mídia paga e transformo número em decisão. Me pergunte sobre ROAS, CPL, custo por resultado, ou peça um diagnóstico da campanha.", sugestoes: ["Diagnostique a mídia paga do período", "Onde estou perdendo eficiência?", "Resumo rápido do painel"] },
  apollo: { nome: "Apollo", papel: "Conteúdo, criativos & SEO", cor: "#FF001E", ini: "Ap", icon: "ag_content", intro: "Sou o Apollo Solace — conteúdo, criativos e SEO. Transformo briefing em peça pronta. Me peça pautas, roteiros, legendas, calendário editorial ou como aparecer mais nas buscas.", sugestoes: ["Monte um calendário da semana", "Escreva uma legenda pra um Reels", "Como aparecer mais no Google e no ChatGPT?"] },
  athena: { nome: "Athena", papel: "Estratégia & orquestração", cor: "#8E5BE0", ini: "At", icon: "ag_strategy", intro: "Sou a Athena Chase — estratégia e orquestração. Ponto de entrada quando você quer visão macro ou não sabe por onde começar. Priorizo demandas, estruturo campanhas e acompanho metas/OKR.", sugestoes: ["Por onde começo minha estratégia?", "Temos várias demandas — o que priorizar?", "Como estão os KRs e metas?"] },
  dionisio: { nome: "Dionísio", papel: "CRM, WhatsApp & relacionamento", cor: "#FF9F0A", ini: "Di", icon: "ag_crm", intro: "Sou o Dionísio Castellan — CRM, WhatsApp e relacionamento. Cuido de como a marca fala com as pessoas. Me peça réguas de WhatsApp, organização de pipeline, reativação de base ou scripts.", sugestoes: ["Régua de WhatsApp pra quem pediu orçamento", "Como reativar a base inativa?", "Onde está o gargalo do funil?"] },
};
// agente PADRÃO por tela (o usuário pode trocar pelo seletor). Base: doc Marketing OS —
// canais/dados → Poseidon; calendário/conteúdo → Apollo; CRM → Dionísio; metas → Athena.
const AGENT_BY_VIEW: Record<string, keyof typeof AGENTS> = {
  overview: "poseidon", ads: "poseidon", canais: "poseidon", concorrencia: "poseidon", config: "poseidon",
  instagram: "poseidon", tiktok: "poseidon", linkedin: "poseidon", youtube: "poseidon", x: "poseidon",
  facebook: "poseidon", threads: "poseidon", reddit: "poseidon", pinterest: "poseidon",
  bluesky: "poseidon", snapchat: "poseidon", googlebusiness: "poseidon",
  calendario: "apollo",
  metas: "athena",
  persona: "dionisio", geracao: "dionisio",
};

// CTA da bolha por tela — chama pra AÇÃO específica do ambiente (some no mobile).
const CTA_BY_VIEW: Record<string, string> = {
  overview: "Vamos analisar seu desempenho?",
  instagram: "Bora turbinar seu Instagram?",
  tiktok: "Bora crescer no TikTok?",
  youtube: "Vamos analisar seu canal?",
  linkedin: "Fortalecer seu LinkedIn?",
  facebook: "Melhorar seu Facebook?",
  x: "Analisar seu X?",
  threads: "Crescer no Threads?",
  googlebusiness: "Melhorar sua ficha no Google?",
  canais: "Vamos comparar seus canais?",
  ads: "Quer otimizar sua mídia paga?",
  concorrencia: "De olho na concorrência?",
  metas: "Vamos revisar suas metas?",
  persona: "Vamos afinar suas personas?",
  geracao: "Bora construir conteúdo juntos?",
  calendario: "Organizamos seu calendário?",
  config: "Precisa de ajuda por aqui?",
};
const ctaFor = (view: string) => CTA_BY_VIEW[view] || "Fale comigo pra melhorar sua análise";

export function AgentDock() {
  const pathname = usePathname();
  const view = viewForPath(pathname);
  const defaultKey = (AGENT_BY_VIEW[view] || "poseidon") as string;
  // agente escolhido manualmente pelo seletor (sobrepõe o padrão da tela)
  const [picked, setPicked] = useState<string | null>(null);
  // personalização: visibilidade dos agentes por painel (Personalização → Assistentes)
  const agentsConfig = useStore((s) => s.agentsConfig);
  const panelId = panelOfView(view);
  const visibleKeys = (Object.keys(AGENTS) as string[]).filter((k) => agentVisibleOn(agentsConfig[k], panelId));
  const effectiveDefault = visibleKeys.includes(defaultKey) ? defaultKey : visibleKeys[0];
  const key = picked && visibleKeys.includes(picked) ? picked : effectiveDefault;
  const a = AGENTS[key];
  const nome = a ? agentDisplayName(a.nome, agentsConfig[key]) : "";
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
  const accounts = useStore((s) => s.zernioAccounts);
  const panelSnapshot = useStore((s) => s.panelSnapshot);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // exporta a conversa atual num PDF (via janela de impressão do navegador)
  const exportPdf = () => {
    const rows = msgs
      .map((m) =>
        m.role === "user"
          ? `<div class="q">${mdToHtml(m.text).replace(/<\/?p>/g, "")}</div>`
          : `<div class="a">${mdToHtml(m.text)}</div>`
      )
      .join("");
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${nome} — Casinha do Marketing</title>
<style>
  *{box-sizing:border-box} body{font-family:Montserrat,-apple-system,system-ui,sans-serif;color:#121111;max-width:720px;margin:36px auto;padding:0 24px;line-height:1.5}
  h1{font-size:20px;margin:0 0 2px} .sub{color:#8a8a8a;font-size:12px;margin:0 0 20px}
  .q{background:#121111;color:#fff;border-radius:12px;padding:10px 14px;margin:16px 0 6px;font-weight:600}
  .a{background:#f4f4f3;border-radius:12px;padding:12px 16px;margin:0 0 8px}
  .a h3,.a h4,.a h5{margin:12px 0 4px;font-size:14px} .a p{margin:6px 0} .a ul{margin:6px 0;padding-left:20px}
  code{background:#ececeb;padding:1px 5px;border-radius:5px;font-size:.9em}
  .ft{margin-top:28px;color:#b5b5b5;font-size:10.5px;text-align:center}
</style></head><body>
  <h1>${nome} · ${a.papel}</h1>
  <div class="sub">Casinha do Marketing — Seahub · assistente com LLM</div>
  ${rows}
  <div class="ft">Gerado pela Casinha do Marketing</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [msgs, open]);

  // ao mudar de tela, volta pro agente contextual (mas o usuário pode trocar de novo)
  useEffect(() => { setPicked(null); }, [view]);

  // histórico do chat — persiste local com validade de 7 dias (renova a cada uso)
  const allMsgs = useStore((s) => s.agentMsgs);
  const [histReady, setHistReady] = useState(false);
  const HKEY = "casinha_agent_hist";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HKEY);
      if (raw) {
        const { savedAt, msgs } = JSON.parse(raw);
        if (savedAt && Date.now() - savedAt < 7 * 864e5 && msgs && typeof msgs === "object") {
          useStore.getState().set({ agentMsgs: msgs });
        } else localStorage.removeItem(HKEY);
      }
    } catch { /* histórico corrompido: ignora */ }
    setHistReady(true);
  }, []);
  useEffect(() => {
    if (!histReady) return;
    try { localStorage.setItem(HKEY, JSON.stringify({ savedAt: Date.now(), msgs: allMsgs })); } catch { /* quota */ }
  }, [allMsgs, histReady]);

  // limpa a conversa do agente atual
  const clearThread = () => {
    const next = { ...useStore.getState().agentMsgs };
    delete next[key];
    useStore.getState().set({ agentMsgs: next });
  };

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
        body: JSON.stringify({
          agentKey: key,
          messages: history,
          scope: { period, year, month, week, quarter },
          accounts: accounts.map((a) => ({
            platform: a.platform, displayName: a.displayName, username: a.username,
            followersCount: a.followersCount, enabled: a.enabled, adsStatus: a.adsStatus,
          })),
          panel: panelSnapshot,
        }),
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

  // nenhum agente visível neste painel (todos ocultos/desativados pela Personalização) → sem dock
  if (!a) return null;

  const av = (
    <div className="ag-av" style={{ background: a.cor }}>
      <Ic name={a.icon} />
    </div>
  );

  return (
    <div id="agentDock">
      {open && (
        <div className={`ag-panel${expanded ? " big" : ""}`}>
          <div className="ag-head">
            <div className="ag-head-l">
              {av}
              <div>
                <b>{nome}</b>
                <span>{a.papel}</span>
              </div>
            </div>
            <div className="ag-head-r">
              {msgs.length > 0 && (
                <button className="ag-x ag-x-txt" onClick={clearThread} aria-label="Novo chat" title="Começar uma conversa nova" type="button">
                  ＋ Novo chat
                </button>
              )}
              {msgs.length > 0 && (
                <button className="ag-x ag-x-txt" onClick={exportPdf} aria-label="Exportar PDF" title="Exportar conversa em PDF" type="button">
                  PDF
                </button>
              )}
              <button className="ag-x" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Recolher" : "Expandir"} title={expanded ? "Recolher" : "Expandir"} type="button">
                {expanded ? "⤡" : "⤢"}
              </button>
              <button className="ag-x" onClick={toggle} aria-label="Fechar" type="button">
                ✕
              </button>
            </div>
          </div>
          <div className="ag-switch">
            {visibleKeys.map((k) => {
              const ag = AGENTS[k];
              return (
                <button
                  key={k}
                  className={`ag-sw${k === key ? " on" : ""}`}
                  style={{ "--swc": ag.cor } as React.CSSProperties}
                  onClick={() => setPicked(k)}
                  title={`${agentDisplayName(ag.nome, agentsConfig[k])} · ${ag.papel}`}
                  type="button"
                >
                  <Ic name={ag.icon} />
                </button>
              );
            })}
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
                  <div className="ag-bubble">
                    {m.text ? <AgentMarkdown text={m.text} /> : busy && i === msgs.length - 1 ? "…" : null}
                  </div>
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
              placeholder={busy ? `${nome} está pensando…` : `Pergunte ao ${nome}…`}
              autoComplete="off"
              disabled={busy}
            />
            <button onClick={() => send(text)} aria-label="Enviar" type="button" disabled={busy}>
              <Ic name="upload" />
            </button>
          </div>
          <AgentLlmConnect />
          <div className="ag-foot">Assistente com LLM · lê os dados do período · histórico salvo por 7 dias</div>
        </div>
      )}
      <div className="ag-fab-row">
        {!open && (
          <button className="ag-cta" onClick={toggle} type="button">
            {ctaFor(view)}
          </button>
        )}
        <button
          className={`ag-fab${open ? " open" : ""}`}
          style={{ "--agc": a.cor } as React.CSSProperties}
          onClick={toggle}
          aria-label={`Assistente ${nome}`}
          type="button"
        >
          {open ? "✕" : <Ic name="ag_chat" />}
        </button>
      </div>
    </div>
  );
}
