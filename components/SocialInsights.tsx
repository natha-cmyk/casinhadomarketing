"use client";
// Analytics social genérico por workspace (via Zernio). Serve Instagram e os
// painéis de rede (canal/[rede]). Dado real quando a conta está conectada;
// estado vazio quando não. Respeita o período (janela ≤ 90 dias).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { lineChart } from "@/lib/charts";
import { fmt, kfmt } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";
import { REDES } from "@/lib/seed-data";
import type { AnalyticsResponse } from "@/lib/zernio";

// id da rede (Casinha) → plataforma da Zernio
const ZP: Record<string, string> = { x: "twitter" };
const zplat = (id: string) => ZP[id] || id;
// plataformas que têm analytics no Zernio
const COM_ANALYTICS = new Set(["instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter"]);

const METRIC_PT: Record<string, string> = {
  reach: "Alcance", reach_unique: "Alcance", impressions: "Impressões", views: "Visualizações",
  profile_views: "Visitas ao perfil", follower_count: "Seguidores", followers: "Seguidores",
  accounts_engaged: "Contas engajadas", total_interactions: "Interações", likes: "Curtidas",
  comments: "Comentários", shares: "Compart.", saves: "Salvos", subscribers: "Inscritos",
  watch_time: "Tempo de exibição", clicks: "Cliques", video_count: "Vídeos",
};
const pt = (k: string) => METRIC_PT[k] || k.replace(/_/g, " ");
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dateRange(scope: { period: Period; year: number; month: number; quarter: number }) {
  const { period, year, month, quarter } = scope;
  let since: Date, until: Date;
  if (period === "trimestre") {
    since = new Date(year, quarter * 3, 1);
    until = new Date(year, quarter * 3 + 2, daysInMonth(year, quarter * 3 + 2));
  } else if (period === "ano") {
    until = new Date(year, 11, 31);
    since = new Date(year, 9, 2);
  } else {
    since = new Date(year, month, 1);
    until = new Date(year, month, daysInMonth(year, month));
  }
  const cap = 90 * 864e5;
  if (until.getTime() - since.getTime() > cap) since = new Date(until.getTime() - cap);
  return { since: iso(since), until: iso(until) };
}

export function SocialInsights({ rede }: { rede: string }) {
  const s = useStore();
  const platform = zplat(rede);
  const meta = REDES.find((r) => r.id === rede);
  const label = meta?.label || rede;
  const eyebrow = `CANAIS · ${label.toUpperCase()}`;
  const acct = s.zernioAccounts.find((a) => a.platform === platform);

  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!acct || !COM_ANALYTICS.has(platform)) return;
    const { since, until } = dateRange(s);
    setLoading(true);
    setErr(null);
    fetch(`/api/zernio/analytics?platform=${platform}&accountId=${acct._id}&since=${since}&until=${until}`)
      .then((r) => r.json())
      .then((d) => (d?.error ? setErr(String(d.error)) : setData(d)))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acct?._id, platform, s.period, s.year, s.month, s.quarter, s.week]);

  if (!acct) {
    return (
      <>
        <PageHead eyebrow={eyebrow} title={label} desc="Métricas reais unificadas pela Zernio." />
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>🔌</div>
          <h3>{label} não conectado</h3>
          <p>
            Conecte a conta em{" "}
            <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>
              Personalização → Conexões
            </Link>{" "}
            para ver as métricas reais aqui.
          </p>
        </div>
      </>
    );
  }

  const metrics = data?.metrics || {};
  const keys = Object.keys(metrics);
  const comSerie = keys.filter((k) => metrics[k].values?.length);

  return (
    <>
      <PageHead
        eyebrow={eyebrow}
        title={label}
        desc={`${acct.displayName || "conta conectada"} · dados reais (Zernio)${data ? ` · ${data.dateRange.since} → ${data.dateRange.until}` : ""}`}
      />
      {loading && <div className="card">Carregando métricas…</div>}
      {err && <div className="auth-err">{err}</div>}
      {!loading && !err && (
        <div className="grid" style={{ gap: 16 }}>
          {/* TODOS os indicadores como KPI (totais no período) */}
          <div className="grid kpis">
            <KpiCard lbl="Seguidores" val={acct.followersCount != null ? fmt(acct.followersCount) : "—"} />
            {keys.map((k) => (
              <KpiCard key={k} lbl={pt(k)} val={kfmt(metrics[k].total)} foot={metrics[k].unit || undefined} />
            ))}
          </div>
          {/* Um gráfico por indicador com série temporal */}
          {comSerie.map((k) => (
            <div className="card" key={k}>
              <div className="card-head">
                <div className="t">{pt(k)}</div>
                <span className="badge">no período</span>
              </div>
              <Chart
                svg={lineChart(
                  metrics[k].values.map((v) => v.date.slice(5)),
                  [{ name: pt(k), color: meta?.cor || "#FF001E", data: metrics[k].values.map((v) => v.value), fill: true }],
                  { sel: metrics[k].values.length - 1 }
                )}
              />
            </div>
          ))}
          {keys.length === 0 && (
            <div className="card">Sem métricas no período — a conta pode não ter o add-on de Analytics da Zernio (plano), ou ainda não há dados.</div>
          )}
        </div>
      )}
    </>
  );
}
