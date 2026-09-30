"use client";
// Biblioteca de relatórios + geração via Assistente (Panteão). Escopado pelo painel atual.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { AGENTS_META, panelOfView, type AgentKey } from "@/lib/agents-meta";
import { scopeLabelText } from "@/lib/scope";

interface Report {
  id: string; panel: string; title: string; content: string;
  agentKey: string | null; agentName: string | null; periodLabel: string | null; createdAt: string;
}

// agente padrão por painel
function defaultAgent(panel: string): AgentKey {
  if (panel === "geracao") return "dionisio";
  if (panel === "ads" || panel === "redes") return "poseidon";
  if (panel === "metas") return "athena";
  return "athena";
}

// render markdown MÍNIMO (títulos, negrito, listas, parágrafos)
function Markdown({ text }: { text: string }): ReactNode {
  const lines = text.split(/\r?\n/);
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`u${out.length}`} className="rp-ul">{list}</ul>); list = []; } };
  const inline = (s: string): ReactNode =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p));
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (/^#{1,6}\s/.test(t)) { flush(); const lvl = t.match(/^#+/)![0].length; const txt = t.replace(/^#+\s/, ""); out.push(lvl <= 2 ? <h4 key={i} className="rp-h">{txt}</h4> : <h5 key={i} className="rp-h2">{txt}</h5>); }
    else if (/^[-*•]\s/.test(t)) { list.push(<li key={i}>{inline(t.replace(/^[-*•]\s/, ""))}</li>); }
    else if (!t) { flush(); }
    else { flush(); out.push(<p key={i} className="rp-p">{inline(t)}</p>); }
  });
  flush();
  return <div className="rp-md">{out}</div>;
}

export function ReportsModal({ view, onClose }: { view: string; onClose: () => void }) {
  const panel = panelOfView(view);
  const s = useStore();
  const scope = { period: s.period, year: s.year, month: s.month, week: s.week, quarter: s.quarter };
  const periodLabel = scopeLabelText(scope);
  const snapshot = useStore((st) => st.panelSnapshot);
  const agentsConfig = useStore((st) => st.agentsConfig);

  const [tab, setTab] = useState<"gen" | "lib">("gen");
  const [reports, setReports] = useState<Report[]>([]);
  const [agentKey, setAgentKey] = useState<AgentKey>(defaultAgent(panel));
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<Report | null>(null);

  const load = useCallback(() => fetch(`/api/reports?panel=${panel}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setReports(d.reports || [])).catch(() => {}), [panel]);
  useEffect(() => { load(); }, [load]);

  const agentName = useMemo(() => {
    const factory = AGENTS_META.find((a) => a.key === agentKey)?.nome || agentKey;
    return (agentsConfig?.[agentKey]?.name || "").trim() || factory;
  }, [agentKey, agentsConfig]);

  async function generate() {
    setStreaming(true); setContent(""); setViewing(null);
    const prompt = `Gere um RELATÓRIO de desempenho em markdown do painel "${view}" no período ${periodLabel}. ` +
      `Estruture em seções: ## Resumo executivo; ## Principais números; ## Variações (o que subiu e o que caiu); ## Insights; ## Recomendações práticas. ` +
      `Use SOMENTE os dados reais do contexto do workspace — não invente números. Seja objetivo, direto e acionável.`;
    setTitle(`Relatório · ${AGENTS_META.find((a) => a.key === agentKey)?.papel?.split(",")[0] || "desempenho"} · ${periodLabel}`);
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentKey, messages: [{ role: "user", text: prompt }], scope, panel: snapshot?.data }),
      });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const j = await res.json();
        setContent(j?.message || "A LLM não está disponível neste ambiente. Conecte em Personalização → Conexões.");
      } else if (res.body) {
        const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = "";
        for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); setContent(acc); }
      }
    } catch { setContent("Não consegui gerar o relatório agora. Tente de novo."); }
    finally { setStreaming(false); }
  }

  async function save() {
    if (!content.trim() || !title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/reports", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ panel, title, content, agentKey, agentName, periodLabel }),
      });
      await load(); setTab("lib"); setContent(""); setTitle("");
    } catch {} finally { setSaving(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/reports?id=${id}`, { method: "DELETE" }).catch(() => {});
    setReports((rs) => rs.filter((r) => r.id !== id));
    if (viewing?.id === id) setViewing(null);
  }

  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rp-head">
          <div className="rp-tabs">
            <button className={tab === "gen" ? "on" : ""} onClick={() => { setTab("gen"); setViewing(null); }}>Gerar relatório</button>
            <button className={tab === "lib" ? "on" : ""} onClick={() => setTab("lib")}>Biblioteca {reports.length ? `(${reports.length})` : ""}</button>
          </div>
          <button className="rp-x" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        {tab === "gen" ? (
          <div className="rp-body">
            <div className="rp-gen-ctrls">
              <span className="rp-lbl">Assistente:</span>
              <div className="rp-agents">
                {AGENTS_META.map((a) => (
                  <button key={a.key} className={"rp-agent" + (agentKey === a.key ? " on" : "")} onClick={() => setAgentKey(a.key)} style={agentKey === a.key ? { borderColor: a.cor, color: a.cor } : undefined}>
                    {(agentsConfig?.[a.key]?.name || "").trim() || a.nome}
                  </button>
                ))}
              </div>
              <button className="rp-gen-btn" onClick={generate} disabled={streaming}>
                {streaming ? "Gerando…" : content ? "Gerar de novo" : "Gerar relatório"}
              </button>
            </div>
            <div className="rp-note">Período: <b>{periodLabel}</b> · painel <b>{view}</b>. O assistente usa os números que estão na tela.</div>

            {content && (
              <>
                <div className="rp-preview"><Markdown text={content} /></div>
                <div className="rp-save-row">
                  <input className="rp-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do relatório" />
                  <button className="rp-save-btn" onClick={save} disabled={saving || streaming}>{saving ? "Salvando…" : "Salvar na biblioteca"}</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="rp-body">
            {viewing ? (
              <>
                <button className="rp-back" onClick={() => setViewing(null)}>‹ voltar à lista</button>
                <div className="rp-view-head"><b>{viewing.title}</b><span>{viewing.agentName} · {new Date(viewing.createdAt).toLocaleString("pt-BR")}</span></div>
                <div className="rp-preview"><Markdown text={viewing.content} /></div>
              </>
            ) : reports.length === 0 ? (
              <div className="rp-empty">Nenhum relatório salvo neste painel ainda. Gere o primeiro na aba “Gerar relatório”.</div>
            ) : (
              <div className="rp-list">
                {reports.map((r) => (
                  <div key={r.id} className="rp-item">
                    <button className="rp-item-main" onClick={() => setViewing(r)}>
                      <b>{r.title}</b>
                      <span>{r.agentName || "—"} · {r.periodLabel || ""} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}</span>
                    </button>
                    <button className="rp-item-del" onClick={() => remove(r.id)} aria-label="Excluir">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
