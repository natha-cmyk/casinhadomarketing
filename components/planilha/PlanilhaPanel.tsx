"use client";
// Painel da PLANILHA ANUAL no overview: troca de abas (Insights · Geração · Planejamento · Canais Pagos),
// navegação de ano (histórico) e toggle de semanas. Busca a matriz por aba e delega ao motor PlanilhaAnual.
// Reage ao período da barra de cima (destaque da coluna) — o ano segue a barra por padrão, com stepper local.
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PLANILHA_TABS, type CellKind } from "@/lib/planilha/spec";
import { type PlanilhaPayload, type PlanilhaConfig, emptyRow, emptyConfig } from "@/lib/planilha/types";
import { applyConfig } from "@/lib/planilha/apply";
import { parseBR } from "@/lib/format";
import { IconBtn } from "@/components/ui";
import { PlanilhaAnual } from "./PlanilhaAnual";
import { PlanilhaOrganize } from "./PlanilhaOrganize";
import { GeracaoCharts } from "./GeracaoCharts";
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
  const [focusOn, setFocusOn] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg">("md");

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

  // ── personalização (ocultar / reordenar / indicadores manuais) ──
  const [organize, setOrganize] = useState(false);
  const config: PlanilhaConfig = payload?.config ?? emptyConfig();
  const fullSections = payload ? applyConfig(payload.sections, config, true) : [];
  const effectiveSections = payload ? applyConfig(payload.sections, config, false) : [];
  const hiddenSet = new Set(config.hidden);
  const customKeys = new Set(config.custom.map((c) => c.key));
  const persistConfig = (next: PlanilhaConfig) => {
    setPayload((p) => { if (!p) return p; const np = { ...p, config: next }; CACHE.set(`${year}|${tab}`, np); return np; });
    fetch("/api/overview/planilha/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ tab, hidden: next.hidden, custom: next.custom, order: next.order }) }).catch(() => {});
  };
  const toggleHide = (key: string) => {
    const h = new Set(config.hidden); if (h.has(key)) h.delete(key); else h.add(key);
    persistConfig({ ...config, hidden: [...h] });
  };
  const moveRow = (secTitle: string, key: string, dir: -1 | 1) => {
    const sec = fullSections.find((s) => s.title === secTitle); if (!sec) return;
    const keys = sec.rows.map((r) => r.key);
    const i = keys.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    persistConfig({ ...config, order: { ...config.order, [secTitle]: keys } });
  };
  const addCustom = (c: { section: string; label: string; kind: CellKind }) => {
    const key = "custom_" + Math.random().toString(36).slice(2, 10);
    persistConfig({ ...config, custom: [...config.custom, { ...c, key }] });
  };
  const removeCustom = (key: string) => {
    persistConfig({ ...config, custom: config.custom.filter((c) => c.key !== key), hidden: config.hidden.filter((h) => h !== key) });
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
            <IconBtn label={showWeeks ? "Semanas (W1–W4) visíveis" : "Mostrar semanas (W1–W4)"} active={showWeeks} onClick={() => setShowWeeks((v) => !v)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 5v14M10 5v14M14 5v14M18 5v14" /></svg>
            </IconBtn>
          )}
          <IconBtn label="Foco no mês (desfoca os outros)" active={focusOn} onClick={() => setFocusOn((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="6.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" strokeLinecap="round" /><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /></svg>
          </IconBtn>
          <IconBtn label={`Tamanho da fonte: ${fontSize === "sm" ? "compacto" : fontSize === "lg" ? "grande" : "normal"} (clique alterna)`} onClick={() => setFontSize((s) => (s === "sm" ? "md" : s === "md" ? "lg" : "sm"))}>
            <span style={{ fontWeight: 800, fontSize: fontSize === "sm" ? 12 : fontSize === "lg" ? 17 : 14, lineHeight: 1 }}>A</span>
          </IconBtn>
          <IconBtn
            label={cmpMode === "off" ? "Comparar com o ano anterior (clique alterna Δ Ano → Δ Mês)" : cmpMode === "ano" ? `Comparando: Δ Ano vs ${year - 1} (clique → Δ Mês)` : `Comparando: Δ Mês vs ${year - 1} (clique → desliga)`}
            active={cmpMode !== "off"}
            onClick={() => setCmpMode((m) => (m === "off" ? "ano" : m === "ano" ? "mes" : "off"))}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17V6M7 6L4 9M7 6l3 3" /><path d="M17 7v11M17 18l-3-3M17 18l3-3" /></svg>
          </IconBtn>
          <IconBtn label="Editar valores manualmente (por mês)" active={editMode} onClick={() => setEditMode((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M14 6l4 4" /></svg>
          </IconBtn>
          <IconBtn label="Organizar (ocultar, reordenar, adicionar indicador)" active={organize} onClick={() => setOrganize((v) => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8h8M16 8h4M4 16h4M12 16h8" /><circle cx="14" cy="8" r="2.3" /><circle cx="8" cy="16" r="2.3" /></svg>
          </IconBtn>
        </div>
      </div>

      {/* legenda da comparação — deixa explícito o que está sendo comparado */}
      {cmpMode !== "off" && (
        <div className="pl-cmpnote">
          Comparando com <b>{year - 1}</b>:{" "}
          {cmpMode === "ano"
            ? <>variação (Δ) nas colunas de <b>trimestre (Q)</b> e do <b>ano</b>, vs {year - 1}.</>
            : <>variação (Δ) em cada <b>total de mês</b>, vs o <b>mesmo mês</b> de {year - 1}.</>}
        </div>
      )}

      {/* corpo */}
      {loading && !payload ? (
        <div style={{ padding: 28 }}><Spinner texto="Carregando planilha…" /></div>
      ) : payload ? (
        <>
          {organize && (
            <PlanilhaOrganize
              sections={fullSections}
              hidden={hiddenSet}
              customKeys={customKeys}
              onToggleHide={toggleHide}
              onMove={moveRow}
              onAddCustom={addCustom}
              onRemoveCustom={removeCustom}
            />
          )}
          <PlanilhaAnual
            sections={effectiveSections}
            weekly={payload.weekly}
            data={payload.data}
            year={year}
            scope={scope}
            showWeeks={showWeeks}
            editMode={editMode}
            onEdit={saveCell}
            cmpMode={cmpMode}
            cmpData={cmpData}
            focusMonth={focusOn ? month : null}
            fontSize={fontSize}
          />
          {editMode && (
            <div className="pl-coverage" style={{ color: "var(--cyan)" }}>
              Modo edição: preencha os valores por mês (salva sozinho). Percentuais em % (ex.: 20,3). Vazio apaga a célula.
            </div>
          )}
          {tab === "geracao" && <GeracaoCharts data={payload.data} sections={payload.sections} year={year} />}
          {payload.coverage && <div className="pl-coverage">{payload.coverage}</div>}
        </>
      ) : (
        <div className="pl-coverage" style={{ padding: 24 }}>Sem dados para {year}.</div>
      )}
    </div>
  );
}
