"use client";
// Painel da PLANILHA ANUAL no overview: troca de abas (Insights · Geração · Planejamento · Canais Pagos),
// navegação de ano (histórico) e toggle de semanas. Busca a matriz por aba e delega ao motor PlanilhaAnual.
// Reage ao período da barra de cima (destaque da coluna) — o ano segue a barra por padrão, com stepper local.
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PLANILHA_TABS, type CellKind } from "@/lib/planilha/spec";
import { type PlanilhaPayload, emptyRow } from "@/lib/planilha/types";
import { parseBR } from "@/lib/format";
import { PlanilhaAnual } from "./PlanilhaAnual";
import { Spinner } from "@/components/Spinner";

// cache de módulo (stale-while-revalidate) por `ano|aba`
const CACHE = new Map<string, PlanilhaPayload>();

export function PlanilhaPanel() {
  const period = useStore((s) => s.period);
  const storeYear = useStore((s) => s.year);
  const month = useStore((s) => s.month);
  const quarter = useStore((s) => s.quarter);
  const week = useStore((s) => s.week);

  const [tab, setTab] = useState<string>("insights");
  const [year, setYear] = useState<number>(storeYear);
  const [showWeeks, setShowWeeks] = useState<boolean>(true);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [cmpMode, setCmpMode] = useState<"off" | "ano" | "mes">("off");
  const [cmpPayload, setCmpPayload] = useState<PlanilhaPayload | null>(null);

  // segue a barra de cima quando o ano dela muda (padrão render-time recomendado, sem efeito)
  const [prevStoreYear, setPrevStoreYear] = useState<number>(storeYear);
  if (storeYear !== prevStoreYear) { setPrevStoreYear(storeYear); setYear(storeYear); }

  const key = `${year}|${tab}`;
  const [payload, setPayload] = useState<PlanilhaPayload | null>(CACHE.get(key) ?? null);
  const [loading, setLoading] = useState<boolean>(!CACHE.get(key));

  // ao trocar (ano|aba), prepara a partir do cache em tempo de render — evita setState dentro do efeito
  const [prevKey, setPrevKey] = useState<string>(key);
  if (key !== prevKey) {
    setPrevKey(key);
    const c = CACHE.get(key) ?? null;
    setPayload(c);
    setLoading(!c);
  }

  useEffect(() => {
    let alive = true;
    fetch(`/api/overview/planilha?year=${year}&tab=${tab}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: PlanilhaPayload) => {
        if (!alive || !d || (d as { error?: string }).error) return;
        CACHE.set(`${d.year}|${d.tab}`, d);
        setPayload(d);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [year, tab]);

  const scope = { period, month, quarter, week, year: storeYear };
  // comparação: busca o ANO ANTERIOR quando ligado; cmpData só vale se casar (ano-1, mesma aba)
  useEffect(() => {
    if (cmpMode === "off") return;
    let alive = true;
    fetch(`/api/overview/planilha?year=${year - 1}&tab=${tab}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: PlanilhaPayload) => { if (alive && d && !(d as { error?: string }).error) setCmpPayload(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [cmpMode, year, tab]);
  const cmpData =
    cmpMode !== "off" && cmpPayload && cmpPayload.year === year - 1 && cmpPayload.tab === tab ? cmpPayload.data : undefined;

  // preenchimento manual: grava a célula do MÊS (semana=-1) + atualiza a tela na hora
  const saveCell = (rowKey: string, kind: CellKind, monthIdx: number, raw: string) => {
    const s = raw.trim();
    let valor: number | null = null, texto: string | null = null;
    if (kind === "text") texto = s || null;
    else if (s !== "") { const n = parseBR(s); valor = kind === "pct" ? n / 100 : n; }
    setPayload((p) => {
      if (!p) return p;
      const data = { ...p.data };
      const prev = data[rowKey];
      const rd = prev ? { weeks: prev.weeks, months: [...prev.months], year: prev.year } : emptyRow();
      rd.months[monthIdx] = kind === "text" ? texto : valor;
      data[rowKey] = rd;
      const np = { ...p, data };
      CACHE.set(`${year}|${tab}`, np);
      return np;
    });
    fetch("/api/overview/planilha/cell", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tab, metric: rowKey, ano: year, mes: monthIdx + 1, semana: -1, valor, texto }),
    }).catch(() => {});
  };

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* barra de controle */}
      <div className="pl-toolbar">
        <div className="pl-tabs" role="tablist">
          {PLANILHA_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={"pl-tab" + (tab === t.id ? " on" : "")}
              onClick={() => setTab(t.id)}
              title={t.sub}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pl-ctrls">
          <div className="pl-year-nav">
            <button className="pl-step" onClick={() => setYear((y) => y - 1)} aria-label="Ano anterior">‹</button>
            <span className="pl-year-val tnum">{year}</span>
            <button
              className="pl-step"
              onClick={() => setYear((y) => y + 1)}
              disabled={year >= storeYear + 1}
              aria-label="Próximo ano"
            >›</button>
          </div>
          {payload?.weekly && !editMode && (
            <button
              className={"pl-weektgl" + (showWeeks ? " on" : "")}
              onClick={() => setShowWeeks((v) => !v)}
              title="Mostrar/ocultar as semanas (W1–W4) dentro de cada mês"
            >
              {showWeeks ? "Semanas ✓" : "Semanas"}
            </button>
          )}
          <button
            className={"pl-weektgl" + (cmpMode !== "off" ? " on" : "")}
            onClick={() => setCmpMode((m) => (m === "off" ? "ano" : m === "ano" ? "mes" : "off"))}
            title="Comparar com o ano anterior. Um clique alterna: Δ Ano (na coluna do ano) → Δ Mês (em cada total de mês) → desliga."
          >
            {cmpMode === "off" ? "Comparar" : cmpMode === "ano" ? "Δ Ano ✓" : "Δ Mês ✓"}
          </button>
          <button
            className={"pl-weektgl" + (editMode ? " on" : "")}
            onClick={() => setEditMode((v) => !v)}
            title="Preencher/editar valores manualmente (por mês). Salva automaticamente."
          >
            {editMode ? "Editando ✓" : "Editar"}
          </button>
        </div>
      </div>

      {/* corpo */}
      {loading && !payload ? (
        <div style={{ padding: 28 }}><Spinner texto="Carregando planilha…" /></div>
      ) : payload ? (
        <>
          <PlanilhaAnual
            sections={payload.sections}
            weekly={payload.weekly}
            data={payload.data}
            year={year}
            scope={scope}
            showWeeks={showWeeks}
            editMode={editMode}
            onEdit={saveCell}
            cmpMode={cmpMode}
            cmpData={cmpData}
          />
          {editMode && (
            <div className="pl-coverage" style={{ color: "var(--cyan)" }}>
              Modo edição: preencha os valores por mês (salva sozinho). Percentuais em % (ex.: 20,3). Vazio apaga a célula.
            </div>
          )}
          {payload.coverage && <div className="pl-coverage">{payload.coverage}</div>}
        </>
      ) : (
        <div className="pl-coverage" style={{ padding: 24 }}>Sem dados para {year}.</div>
      )}
    </div>
  );
}
