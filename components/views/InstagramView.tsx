"use client";
// Instagram por workspace, via Zernio. Dado real quando a conta está conectada;
// estado vazio quando não. Respeita o período (janela de datas, máx 90 dias).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { PageHead, KpiCard } from "@/components/ui";
import { Chart } from "@/components/Chart";
import { lineChart } from "@/lib/charts";
import { fmt, kfmt } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";
import type { AnalyticsResponse } from "@/lib/zernio";

const METRIC_PT: Record<string, string> = {
  reach: "Alcance", reach_unique: "Alcance", impressions: "Impressões", views: "Visualizações",
  profile_views: "Visitas ao perfil", follower_count: "Seguidores", followers: "Seguidores",
  accounts_engaged: "Contas engajadas", total_interactions: "Interações", likes: "Curtidas",
  comments: "Comentários", shares: "Compart.", saves: "Salvos",
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
    since = new Date(year, 9, 2); // ~90 dias
  } else {
    since = new Date(year, month, 1);
    until = new Date(year, month, daysInMonth(year, month));
  }
  const cap = 90 * 864e5;
  if (until.getTime() - since.getTime() > cap) since = new Date(until.getTime() - cap);
  return { since: iso(since), until: iso(until) };
}

export function InstagramView() {
  const s = useStore();
  const ig = s.zernioAccounts.find((a) => a.platform === "instagram");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ig) return;
    const { since, until } = dateRange(s);
    setLoading(true);
    setErr(null);
    fetch(`/api/zernio/analytics?platform=instagram&accountId=${ig._id}&since=${since}&until=${until}`)
      .then((r) => r.json())
      .then((d) => (d?.error ? setErr(String(d.error)) : setData(d)))
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ig?._id, s.period, s.year, s.month, s.quarter, s.week]);

  if (!ig) {
    return (
      <>
        <PageHead eyebrow="CANAIS · INSTAGRAM" title="Instagram" desc="Métricas reais unificadas pela Zernio." />
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 24 }}>📷</div>
          <h3>Instagram não conectado</h3>
          <p>
            Conecte a conta do Instagram em <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>Personalização → Conexões</Link> para ver seguidores, alcance, visualizações e engajamento reais.
          </p>
        </div>
      </>
    );
  }

  const metrics = data?.metrics || {};
  const keys = Object.keys(metrics);
  const chartKey = keys.find((k) => metrics[k].values?.length) || keys[0];
  const svg =
    chartKey && metrics[chartKey]?.values?.length
      ? lineChart(
          metrics[chartKey].values.map((v) => v.date.slice(5)),
          [{ name: pt(chartKey), color: "#FF001E", data: metrics[chartKey].values.map((v) => v.value), fill: true }],
          { sel: metrics[chartKey].values.length - 1 }
        )
      : null;

  return (
    <>
      <PageHead
        eyebrow="CANAIS · INSTAGRAM"
        title="Instagram"
        desc={`${ig.displayName || "conta conectada"} · dados reais (Zernio)${data ? ` · ${data.dateRange.since} → ${data.dateRange.until}` : ""}`}
      />
      {loading && <div className="card">Carregando métricas…</div>}
      {err && <div className="auth-err">{err}</div>}
      {!loading && !err && (
        <div className="grid" style={{ gap: 16 }}>
          <div className="grid kpis">
            <KpiCard lbl="Seguidores" val={ig.followersCount != null ? fmt(ig.followersCount) : "—"} />
            {keys.slice(0, 3).map((k) => (
              <KpiCard key={k} lbl={pt(k)} val={kfmt(metrics[k].total)} />
            ))}
          </div>
          {svg && (
            <div className="card">
              <div className="card-head">
                <div className="t">{pt(chartKey!)}</div>
                <span className="badge">período</span>
              </div>
              <Chart svg={svg} />
            </div>
          )}
          {keys.length === 0 && (
            <div className="card">Sem métricas no período — a conta pode não ter o add-on de Analytics da Zernio, ou ainda não há dados.</div>
          )}
        </div>
      )}
    </>
  );
}
