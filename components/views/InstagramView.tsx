"use client";
// Portado de viewInstagram (blueprint 853-971) + helpers bar/miniM/kpiCard. Fidelidade 1:1.
// Bloco 3: renderizamos todos os blocos (sem gate por state.ind / shownInd).
import { Fragment, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { fmt, kfmt, pct, sum, avg } from "@/lib/format";
import {
  MONTHS,
  scopeVal,
  chartSeries,
  autoCompare,
  scopeLabelText,
  computeDelta,
  type Scope,
} from "@/lib/scope";
import { igMonthly, igWk } from "@/lib/seed-data";
import { lineChart, type LineSeries } from "@/lib/charts";
import { Chart } from "@/components/Chart";
import { Ic } from "@/components/Ic";
import { KpiCard, DeltaChip, BarRow, MiniStat } from "@/components/ui";

type WkGetter = (y: number, m: number, w: number) => number;

// substitui cmpBlock do blueprint (linhas 739-746) — retorna as .row do bloco .cmp
function cmpRows(
  gm: (y: number) => number[],
  gw: WkGetter,
  scope: Scope,
  scenario: boolean,
  cmp: Scope
): ReactNode {
  const rows = autoCompare(gm, gw, scope);
  let scnRow: ReactNode = null;
  if (scenario) {
    const c = scopeVal(gm(scope.year), gw, scope);
    const b = scopeVal(gm(cmp.year), gw, cmp);
    scnRow = (
      <div className="row">
        <DeltaChip delta={computeDelta(c, b, true)} scn /> vs cenário
      </div>
    );
  }
  if (!rows.length && !scnRow) return null;
  return (
    <>
      {rows.map(([l, c, p], i) => (
        <div className="row" key={i}>
          <DeltaChip delta={computeDelta(c, p, true)} /> {l}
        </div>
      ))}
      {scnRow}
    </>
  );
}

const PROFS: [string, string][] = [
  ["seahub", "@seahubcoworking"],
  ["seabox", "@seaboxbyseahub"],
  ["hub", "@hubempreendedoras"],
];

export function InstagramView() {
  const s = useStore();
  const set = s.set;
  const scope: Scope = { period: s.period, year: s.year, month: s.month, week: s.week, quarter: s.quarter };
  const { period, year, month, quarter } = scope;
  const prof = s.igProfile || "seahub";

  const profSel = (
    <div className="ig-profile" style={{ justifyContent: "flex-end" }}>
      <span style={{ fontSize: 11, color: "var(--label-3)" }}>Perfil</span>
      <div className="seg small" role="group" aria-label="Perfil">
        {PROFS.map(([v, l]) => (
          <button key={v} className={prof === v ? "on" : ""} onClick={() => set({ igProfile: v })} type="button">
            {l}
          </button>
        ))}
      </div>
    </div>
  );

  if (prof !== "seahub") {
    const lbl = (PROFS.find((p) => p[0] === prof) || PROFS[0])[1];
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">Canais · Instagram</div>
            <h2>Instagram</h2>
            <p>Visão multi-perfil — cada produto com Instagram próprio entra aqui.</p>
          </div>
          {profSel}
        </div>
        <div className="card pad-lg">
          <div className="scaffold-hero">
            <div className="icon">
              <Ic name="ig" />
            </div>
            <div>
              <span className="soon">Perfil sem dados conectados ainda</span>
              <div className="t" style={{ fontSize: 15, fontWeight: 640 }}>{lbl}</div>
            </div>
          </div>
          <p style={{ color: "var(--label-2)", fontSize: 12.5, margin: "8px 0 0", lineHeight: 1.5 }}>
            Conecte o Instagram de <b>{lbl}</b> para trazer produção, alcance, engajamento e conversão no mesmo formato do @seahubcoworking. Quando houver uma <b>colab entre perfis</b>, ela aparece vinculada nos dois.
          </p>
        </div>
      </>
    );
  }

  const gm = (m: string) => (yy: number) => igMonthly(m, yy);
  const gw = (m: string): WkGetter => (yy, mo, w) => igWk(m, yy, mo, w);
  const sv = (m: string) => scopeVal(igMonthly(m, year), gw(m), scope);
  const vw = sv("visualizacoes");

  const TOPBANK: Record<number, [string, string, string, string][]> = {
    2026: [
      ["ALERTA DE VÍDEO VIRAL: as melhores salas de reunião do RN", "Reels · Espaços & Humor", "684k", "views"],
      ["VLOG: planejando meu 2026 no Seahub", "Reels · Coworking", "119k", "views"],
      ["#Seahub8Anos — hora de apagar as velinhas", "Reels · Comunidade", "29k", "views"],
    ],
    2025: [
      ["Aftermovie do GO!RN 2025 com o Seahub", "Reels · GO!RN", "305k", "views"],
      ["No Seahub é outra história — EP.1", "Reels · Branding", "52k", "views"],
      ["Training Day do Seahealth", "Reels · Evento", "48k", "views"],
    ],
    2024: [
      ["Campanha de Endereço Fiscal 2024", "Reels · EV", "1.031", "interações"],
      ["A importância do endereço fiscal em 30s", "Reels · EV", "354", "alcance"],
      ["Vídeo institucional Seahub", "Reels · Branding", "560", "visitas"],
    ],
  };
  const TOPC = (TOPBANK[year] || TOPBANK[2026]).map((a) => ({ t: a[0], f: a[1], v: a[2], s: a[3] }));
  const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const SLOTS: [string, number[]][] = [
    ["Manhã", [0.42, 0.46, 0.5, 0.52, 0.55, 0.3, 0.24]],
    ["Tarde", [0.72, 0.76, 0.82, 0.86, 0.9, 0.5, 0.4]],
    ["Noite", [0.85, 0.9, 0.86, 0.9, 0.8, 0.62, 0.5]],
  ];

  const cmpNode = (m: string) => cmpRows(gm(m), gw(m), scope, s.scenario, s.cmp);

  const segArr = igMonthly("totalSeguidores", year);
  const segArrP = igMonthly("totalSeguidores", year - 1);
  const lastNZ = (a: number[]) => {
    for (let i = a.length - 1; i >= 0; i--) if (a[i] > 0) return a[i];
    return 0;
  };
  const mEnd = period === "trimestre" ? Math.min(quarter * 3 + 2, 11) : month;
  const segFim =
    period === "ano"
      ? lastNZ(segArr)
      : (() => {
          for (let i = mEnd; i >= 0; i--) if (segArr[i] > 0) return segArr[i];
          return lastNZ(segArr);
        })();
  const segRows: [string, number, number][] = [];
  if (period === "mes" || period === "semana") {
    if (month > 0 && segArr[month - 1] > 0) segRows.push(["mês passado", segFim, segArr[month - 1]]);
    if (segArrP[month] > 0) segRows.push(["mesmo mês, ano passado", segFim, segArrP[month]]);
  } else if (period === "trimestre") {
    let pv = 0;
    for (let i = quarter * 3 - 1; i >= 0; i--) if (segArr[i] > 0) { pv = segArr[i]; break; }
    if (pv > 0) segRows.push(["trim. passado", segFim, pv]);
    if (segArrP[mEnd] > 0) segRows.push(["mesmo trim., ano passado", segFim, segArrP[mEnd]]);
  } else {
    const lp = lastNZ(segArrP);
    if (lp > 0) segRows.push(["ano passado", segFim, lp]);
  }
  const segCmpNode: ReactNode = segRows.length ? (
    <>
      {segRows.map(([l, c, p], i) => (
        <div className="row" key={i}>
          <DeltaChip delta={computeDelta(c, p, true)} /> {l}
        </div>
      ))}
    </>
  ) : null;

  const scLabel = scopeLabelText(scope);
  const emptyScope = sv("visualizacoes") === 0;

  // séries do gráfico (com destaque na instância) + overlay ano anterior / cenário
  const sVis = chartSeries(gm("visualizacoes"), gw("visualizacoes"), scope);
  const sContas = chartSeries(gm("contas"), gw("contas"), scope);
  let overlay: { labels: string[]; values: number[]; sel: number } | null = null;
  let overlayLbl = "";
  if (s.scenario) {
    overlay = chartSeries(gm("visualizacoes"), gw("visualizacoes"), s.cmp);
    overlayLbl = "Cenário: " + scopeLabelText(s.cmp);
  } else if (igMonthly("visualizacoes", year - 1).some((v) => v > 0)) {
    overlay = chartSeries(gm("visualizacoes"), gw("visualizacoes"), { ...scope, year: year - 1 });
    overlayLbl = "Ano passado";
  }
  const alcanceSeries: LineSeries[] = [
    { data: sVis.values, color: "#FF001E", fill: true, name: "Visualizações" },
    { data: sContas.values, color: "#00BBC5", name: "Contas alcançadas" },
  ];
  if (overlay) alcanceSeries.push({ data: overlay.values, color: s.scenario ? "#00BBC5" : "#9A9AA0", dash: true, name: overlayLbl });

  const posts = sv("posts"), sto = sv("stories"), ree = sv("reels");
  const maxMix = Math.max(posts, sto, ree, 1);
  const eng: [string, number][] = [
    ["Curtidas", sv("curtidas")],
    ["Compartilhamentos", sv("compart")],
    ["Salvos", sv("salvos")],
    ["Comentários", sv("comentarios")],
    ["Reposts", sv("repost")],
  ];
  const maxEng = Math.max(...eng.map((e) => e[1]), 1);
  const novos = sv("seguidoresNovos"), saida = sv("seguidoresSaida");
  const atividades = sv("atividades"), visitas = sv("visitasSite");

  const orgArr = igMonthly("organicoPct", year);
  const orgPct =
    period === "mes" || period === "semana"
      ? orgArr[month] || 0
      : period === "trimestre"
      ? avg(orgArr.slice(quarter * 3, quarter * 3 + 3).filter((v) => v > 0)) || 0
      : avg(orgArr.filter((v) => v > 0)) || 0;
  const orgCount = Math.round(orgPct * sv("contas"));
  const orgLen = year === 2026 ? 7 : 12;
  const orgChart = {
    labels: MONTHS.slice(0, orgLen),
    values: orgArr.slice(0, orgLen).map((v) => (v || 0) * 100),
    sel: (period === "mes" || period === "semana") && month < orgLen ? month : -1,
  };

  const vspArr = igMonthly("viewsSeguidoresPct", year);
  const viewsSegPct = period === "semana" ? vspArr[month] || 0 : avg(vspArr.filter((v) => v > 0)) || 0.2;

  const sLeads = chartSeries(gm("leadsDirect"), gw("leadsDirect"), scope);
  const sCta = chartSeries(gm("ctaCompra"), gw("ctaCompra"), scope);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Canais · Instagram</div>
          <h2>Instagram</h2>
          <p>
            Produção, seguidores, alcance, engajamento e conversão — {scLabel}.
            {emptyScope ? (
              <> <b>Sem lançamento neste período</b> — comparativo com o ano anterior ao lado.</>
            ) : null}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          {profSel}
          <a className="btn-link ig" href="https://instagram.com/seahubcoworking" target="_blank" rel="noopener">
            <Ic name="ig" /> Abrir Instagram
          </a>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Seguidores" val={fmt(segFim)} foot={`líquido ${novos - saida >= 0 ? "+" : ""}${fmt(novos - saida)} no período`}>
          {segCmpNode}
        </KpiCard>
        <KpiCard lbl="Contas alcançadas" val={kfmt(sv("contas"))} foot="alcance">
          {cmpNode("contas")}
        </KpiCard>
        <KpiCard lbl="Visualizações" val={kfmt(sv("visualizacoes"))} foot="impressões">
          {cmpNode("visualizacoes")}
        </KpiCard>
        <KpiCard lbl="Interações" val={kfmt(sv("interacoes"))} foot="engajamento bruto">
          {cmpNode("interacoes")}
        </KpiCard>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.55fr 1fr", marginBottom: 16 }}>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Alcance</div>
              <div className="sub">Visualizações vs. contas · {period}</div>
            </div>
          </div>
          <Chart svg={lineChart(sVis.labels, alcanceSeries, { h: 250, sel: sVis.sel })} />
          <div className="legend">
            <span><i style={{ background: "#FF001E" }} />Visualizações</span>
            <span><i style={{ background: "#00BBC5" }} />Contas alcançadas</span>
            {overlay ? (
              <span><i className={`dash ${s.scenario ? "scn" : ""}`} />{overlayLbl}</span>
            ) : null}
          </div>
        </div>
        <div className="card pad-lg">
          <div className="card-head">
            <div className="t">Mix de conteúdo</div>
            <span className="badge">Vencedor: Reels</span>
          </div>
          {([["Stories", sto, "var(--cyan)"], ["Reels", ree, "var(--red)"], ["Posts", posts, "var(--ink)"]] as [string, number, string][]).map(
            ([k, v, c]) => (
              <BarRow key={k} k={k} v={v} max={maxMix} color={c} formatted={fmt(v)} />
            )
          )}
          <div className="insight" style={{ marginTop: 14 }}>
            <div className="ib" style={{ background: "var(--red)" }}>
              <Ic name="ig" />
            </div>
            <p>
              <b>Reels</b> lidera o alcance em ~90% das semanas.
            </p>
          </div>
        </div>
      </div>

      <div className="card pad-lg" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="t">Seguidores</div>
          <div className="sub">{scLabel}</div>
        </div>
        <div className="mini">
          <MiniStat l="Novos seguidores" n={fmt(novos)} />
          <MiniStat l="Deixaram de seguir" n={fmt(saida)} />
          <MiniStat l="Crescimento líquido" n={"+" + fmt(novos - saida)} />
          <MiniStat l="Total atual" n={fmt(segFim)} />
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Engajamento por tipo</div>
              <div className="sub tnum">{fmt(sum(eng.map((e) => e[1])))} interações</div>
            </div>
          </div>
          {eng.map(([k, v]) => (
            <BarRow key={k} k={k} v={v} max={maxEng} color="var(--cyan)" formatted={fmt(v)} />
          ))}
        </div>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Rendimento orgânico</div>
              <div className="sub tnum">
                {orgPct > 0 ? pct(orgPct) + " · ~" + kfmt(orgCount) + " contas no período" : "sem dado no período"}
              </div>
            </div>
          </div>
          <Chart svg={lineChart(orgChart.labels, [{ data: orgChart.values, color: "#00BBC5", fill: true, name: "Orgânico" }], { h: 200, sel: orgChart.sel, vfmt: "pct" })} />
          <div className="insight" style={{ marginTop: 12 }}>
            <div className="ib" style={{ background: "var(--cyan)" }}>
              <Ic name="ads" />
            </div>
            <p>
              {orgPct > 0 ? (
                <>
                  <b>{pct(orgPct)} · ~{kfmt(orgCount)} contas</b> do alcance vieram do orgânico (não-impulsionado).
                </>
              ) : (
                "Sem alcance orgânico registrado neste período."
              )}{" "}
              Métrica mensal — a linha mostra o ano todo.
            </p>
          </div>
        </div>
      </div>

      <div className="card pad-lg" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div className="t">Atividade & audiência</div>
        </div>
        <div className="mini">
          <MiniStat l="Atividades no perfil" n={fmt(atividades)} />
          <MiniStat l="Visitas no site" n={fmt(visitas)} />
          <MiniStat l="Views de seguidores" n={pct(viewsSegPct) + " · " + kfmt(Math.round(viewsSegPct * vw))} />
          <MiniStat l="Views de não-seguidores" n={pct(1 - viewsSegPct) + " · " + kfmt(Math.round((1 - viewsSegPct) * vw))} />
        </div>
      </div>

      <div className="card pad-lg">
        <div className="card-head">
          <div>
            <div className="t">Conversão social</div>
            <div className="sub">Leads via direct e CTA de compra · {period}</div>
          </div>
        </div>
        <Chart svg={lineChart(sLeads.labels, [{ data: sLeads.values, color: "#FF001E", name: "Leads via direct" }, { data: sCta.values, color: "#121111", name: "CTA de compra" }], { h: 210, sel: sLeads.sel })} />
        <div className="legend">
          <span><i style={{ background: "#FF001E" }} />Leads via direct ({fmt(sv("leadsDirect"))})</span>
          <span><i style={{ background: "#121111" }} />CTA de compra ({fmt(sv("ctaCompra"))})</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", marginTop: 16 }}>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Top conteúdos do período</div>
              <div className="sub">ranking ilustrativo · dados por post via integração do Instagram</div>
            </div>
          </div>
          <div className="top-list">
            {TOPC.map((c, i) => (
              <div className="top-item" key={i}>
                <span className="rank">{i + 1}</span>
                <div>
                  <div className="tt">{c.t}</div>
                  <div className="fmt">{c.f}</div>
                </div>
                <div className="mv">
                  {c.v}
                  <span>{c.s}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card pad-lg">
          <div className="card-head">
            <div>
              <div className="t">Audiência & melhores horários</div>
              <div className="sub">índice relativo de consumo (0–100) · ilustrativo (via IG)</div>
            </div>
          </div>
          <div className="heat" style={{ marginBottom: 8 }}>
            <div />
            {DIAS.map((d) => (
              <div className="hh" key={d}>{d}</div>
            ))}
            {SLOTS.map(([nome, arr]) => (
              <Fragment key={nome}>
                <div className="hh" style={{ justifyContent: "flex-end", paddingRight: 4 }}>{nome}</div>
                {arr.map((v, i) => (
                  <div className="hc" key={i} style={{ background: `rgba(0,187,197,${(0.14 + v * 0.86).toFixed(2)})` }}>
                    {Math.round(v * 100)}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--label-3)", margin: "0 0 12px" }}>
            Cada célula é a <b>intensidade relativa</b> de consumo naquele dia/turno (0 = baixo, 100 = pico) — não é % nem nº de pessoas. Quando conectarmos o IG, vira alcance/visualizações reais por horário.
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--label-2)", margin: "2px 0 6px" }}>Região</div>
          <div className="chips-inline" style={{ marginBottom: 10 }}>
            <b>Natal/RN</b>
            <b>Parnamirim</b>
            <b>Grande Natal</b>
            <b>Outros estados</b>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--label-2)", margin: "2px 0 6px" }}>Interesses</div>
          <div className="chips-inline">
            <b>Empreendedorismo</b>
            <b>Marketing</b>
            <b>Saúde</b>
            <b>Advocacia</b>
            <b>Tecnologia</b>
          </div>
        </div>
      </div>
    </>
  );
}
