"use client";
// Painel da PLANILHA ANUAL no overview: troca de abas (Insights · Geração · Planejamento · Canais Pagos),
// navegação de ano (histórico) e toggle de semanas. Busca a matriz por aba e delega ao motor PlanilhaAnual.
// Reage ao período da barra de cima (destaque da coluna) — o ano segue a barra por padrão, com stepper local.
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PLANILHA_TABS, tabById } from "@/lib/planilha/spec";
import type { PlanilhaPayload } from "@/lib/planilha/types";
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

  const meta = tabById(tab); // só rótulo/sub da aba (a estrutura vem do payload/servidor)
  const scope = { period, month, quarter, week, year: storeYear };

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
          {payload?.weekly && (
            <button
              className={"pl-weektgl" + (showWeeks ? " on" : "")}
              onClick={() => setShowWeeks((v) => !v)}
              title="Mostrar/ocultar as semanas (W1–W4) dentro de cada mês"
            >
              {showWeeks ? "Semanas ✓" : "Semanas"}
            </button>
          )}
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
            sub={meta.sub || meta.label}
            data={payload.data}
            year={year}
            scope={scope}
            showWeeks={showWeeks}
          />
          {payload.coverage && <div className="pl-coverage">{payload.coverage}</div>}
        </>
      ) : (
        <div className="pl-coverage" style={{ padding: 24 }}>Sem dados para {year}.</div>
      )}
    </div>
  );
}
