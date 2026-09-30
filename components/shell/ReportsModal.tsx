"use client";
// Biblioteca de relatórios + geração via Assistente (Panteão). Escopado pelo painel atual.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

// atalhos de TIPO de relatório por painel {label curto, foco do prompt, agente sugerido}
interface Preset { label: string; focus: string; agent?: AgentKey }
const PRESETS: Record<string, Preset[]> = {
  redes: [
    { label: "Desempenho geral", focus: "o desempenho geral do canal — alcance, engajamento, seguidores e produção de conteúdo", agent: "poseidon" },
    { label: "Orgânico + mídia paga", focus: "o resultado INTEGRADO da marca: orgânico (social) somado à mídia paga (Meta/Google Ads) da MESMA marca — investimento, leads e retorno correlacionados", agent: "poseidon" },
    { label: "Conteúdo & formatos", focus: "o que performou melhor por formato (Reels/Stories/Post), temas e ganchos que engajaram", agent: "apollo" },
    { label: "Crescimento de audiência", focus: "o crescimento de seguidores e alcance, ritmo e o que impulsionou ou travou", agent: "poseidon" },
    { label: "Engajamento & comunidade", focus: "qualidade do engajamento (salvos, comentários, compartilhamentos) e relação com a comunidade", agent: "apollo" },
    { label: "Plano de conteúdo", focus: "recomendação de pauta e próximos passos de conteúdo com base no que performou", agent: "apollo" },
  ],
  ads: [
    { label: "Performance de campanhas", focus: "a performance das campanhas pagas — investimento, leads, CPL, CAC, ROAS por campanha", agent: "poseidon" },
    { label: "Eficiência (CAC/ROI)", focus: "a eficiência do investimento — CAC, ROAS, onde escalar e onde cortar verba", agent: "poseidon" },
    { label: "Onde escalar", focus: "onde vale aumentar investimento e onde está saturando, com base em custo e retorno", agent: "poseidon" },
    { label: "Meta vs Google", focus: "comparativo entre as plataformas pagas (Meta Ads vs Google Ads) por eficiência e volume", agent: "poseidon" },
    { label: "Mídia paga × receita", focus: "o elo entre investimento em mídia paga e a receita/vendas gerada (do CRM)", agent: "poseidon" },
  ],
  geracao: [
    { label: "Geração de leads", focus: "a geração de leads por fonte e produto, e de onde vêm os melhores leads", agent: "dionisio" },
    { label: "Receita & vendas", focus: "a receita e as vendas por canal/produto e o funil comercial", agent: "dionisio" },
    { label: "Funil & conversão", focus: "o funil: entrada de leads → qualificação → proposta → ganho/perdido, e taxas de conversão", agent: "poseidon" },
    { label: "Qualidade da base", focus: "a saúde da base — quem está frio/morno/quente e o que fazer com cada grupo", agent: "dionisio" },
    { label: "Motivos de perda", focus: "os principais motivos de perda de leads e como reduzir", agent: "dionisio" },
    { label: "Régua de relacionamento", focus: "uma régua de WhatsApp/mensagens por momento do funil pra reativar e converter a base", agent: "dionisio" },
  ],
  overview: [
    { label: "Panorama do mês", focus: "um panorama geral do mês — social, mídia paga e comercial juntos", agent: "athena" },
    { label: "Destaques & alertas", focus: "os principais destaques (o que subiu e o que caiu) e alertas que merecem atenção", agent: "athena" },
    { label: "Diagnóstico + plano", focus: "um diagnóstico do cenário e um plano de ação priorizado pro próximo período", agent: "athena" },
    { label: "ROI de marketing", focus: "o retorno do marketing — investimento total vs leads/receita gerada", agent: "poseidon" },
    { label: "Relatório executivo", focus: "um relatório executivo enxuto pra diretoria: resultado, eficiência e recomendação", agent: "athena" },
  ],
  metas: [
    { label: "Progresso das metas", focus: "o progresso das metas/OKR (alvo × realizado) e o que falta pra bater", agent: "athena" },
    { label: "Riscos & prioridades", focus: "quais KRs estão em risco e onde focar pra recuperar", agent: "athena" },
  ],
  calendario: [
    { label: "Produção de conteúdo", focus: "o esforço de produção no período — volume por canal, status e consistência", agent: "apollo" },
    { label: "Plano editorial", focus: "um plano editorial pro período com base no que já está pautado e nas lacunas", agent: "apollo" },
  ],
  persona: [{ label: "Persona × audiência", focus: "o alinhamento entre as personas cadastradas e a audiência/base real", agent: "dionisio" }],
  concorrencia: [{ label: "Benchmark competitivo", focus: "um benchmark competitivo com os concorrentes cadastrados e oportunidades de posicionamento", agent: "athena" }],
};
const presetsFor = (panel: string): Preset[] => PRESETS[panel] ?? [
  { label: "Relatório de desempenho", focus: "o desempenho geral do painel no período" },
  { label: "Diagnóstico + plano", focus: "um diagnóstico e um plano de ação com base nos dados do painel", agent: "athena" },
];

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
  const snapshots = useStore((st) => st.snapshots);
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

  async function generate(focus?: string, label?: string, agent?: AgentKey) {
    const useAgent = agent || agentKey;
    if (agent && agent !== agentKey) setAgentKey(agent);
    const f = focus || "o desempenho geral do painel no período";
    setStreaming(true); setContent(""); setViewing(null);
    const prompt = `Gere um RELATÓRIO em markdown sobre ${f}, no painel "${view}", no período ${periodLabel}. ` +
      `Estruture em seções: ## Resumo executivo; ## Principais números; ## Variações (o que subiu e o que caiu); ## Insights; ## Recomendações práticas. ` +
      `Use SOMENTE os dados reais do contexto do workspace — não invente números. Seja objetivo, direto e acionável.`;
    setTitle(`Relatório · ${label || "desempenho"} · ${periodLabel}`);
    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentKey: useAgent, messages: [{ role: "user", text: prompt }], scope, panel: { painelAtual: view, dados: snapshots } }),
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

  if (typeof document === "undefined") return null;
  return createPortal(
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
            <div className="rp-presets">
              <span className="rp-lbl">Tipo:</span>
              {presetsFor(panel).map((p) => (
                <button key={p.label} className="rp-preset-chip" disabled={streaming} onClick={() => generate(p.focus, p.label, p.agent)} title={`Gerar: ${p.focus}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="rp-gen-ctrls">
              <span className="rp-lbl">Assistente:</span>
              <div className="rp-agents">
                {AGENTS_META.map((a) => (
                  <button key={a.key} className={"rp-agent" + (agentKey === a.key ? " on" : "")} onClick={() => setAgentKey(a.key)} style={agentKey === a.key ? { borderColor: a.cor, color: a.cor } : undefined}>
                    {(agentsConfig?.[a.key]?.name || "").trim() || a.nome}
                  </button>
                ))}
              </div>
              <button className="rp-gen-btn" onClick={() => generate()} disabled={streaming}>
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
    </div>,
    document.body
  );
}
