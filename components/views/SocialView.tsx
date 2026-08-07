"use client";
// Porta viewSocial(key) (blueprint 1269-1286): placeholder "conecte via Zernio" ou
// KPIs + gráfico de barras + top conteúdos, respeitando a visibilidade de indicadores.
import { useStore } from "@/lib/store";
import { barChart } from "@/lib/charts";
import { SOC } from "@/lib/seed-data";
import { PageHead, Card, CardHead, KpiCard } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { Ic } from "@/components/Ic";

export function SocialView({ rede }: { rede: string }) {
  const paineis = useStore((st) => st.paineis);
  const s = SOC[rede];

  // shownInd para painéis de rede (não-instagram): visível salvo se marcado false.
  const shownInd = (id: string) => {
    const p = paineis[rede];
    return !p || p[id] !== false;
  };

  if (!s) {
    return (
      <div className="page-head">
        <div>
          <h2>Canal</h2>
        </div>
      </div>
    );
  }

  if (s.placeholder) {
    return (
      <>
        <PageHead
          eyebrow={s.eyebrow}
          title={s.label}
          desc={`Conecte ${s.label} via Zernio para ver alcance, impressões, cliques e engajamento — dados unificados pela API.`}
        />
        <Card padLg>
          <div className="empty" style={{ padding: "44px 12px" }}>
            <div className="e-ico">
              <Ic name="ext" />
            </div>
            <h3>Sem dados ainda</h3>
            <p>
              Ative a conta em Personalização → Redes &amp; canais e conecte via Zernio. As métricas aparecem aqui automaticamente.
            </p>
          </div>
        </Card>
      </>
    );
  }

  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
  const kA = (s.kpis || []).filter((k, idx) => shownInd("kpi_" + idx));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{s.eyebrow}</div>
          <h2>{s.label}</h2>
          <p>
            Gestão de {s.label} · {s.handle}. Indicadores configuráveis na aba Personalização. <b>Dados de exemplo</b> até a conexão via Zernio.
          </p>
        </div>
      </div>

      {kA.length > 0 && (
        <div className="grid kpis" style={{ marginBottom: 16 }}>
          {kA.map((k) => (
            <KpiCard key={k[0]} lbl={k[0]} val={k[1]} foot={k[2]} />
          ))}
        </div>
      )}

      {shownInd("chart") && s.chartVals && (
        <Card padLg style={{ marginBottom: 16 }}>
          <CardHead title={s.chartLabel || ""} sub="2026 · parcial jan–jul · dados de exemplo" />
          <Chart svg={barChart(meses, s.chartVals, s.chartVals.map(() => s.cor), { h: 220, name: s.chartLabel })} />
        </Card>
      )}

      {shownInd("top") && s.top && (
        <Card padLg>
          <CardHead title="Top conteúdos" />
          <ul className="struct-list">
            {s.top.map((t) => (
              <li key={t[0]}>
                <span className="d" style={{ background: s.cor }} />
                {t[0]}
                <span className="meta">{t[1]}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
