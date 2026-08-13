"use client";
// Painel (overview) por workspace: visão geral RICA de cada canal conectado.
// KPIs-herói agregados da empresa no topo + um card estruturado por canal (o mesmo
// olhar analítico do painel de conta). Respeita o período da toolbar (since/until).
// Empty state preservado: nada conectado → CTA p/ Personalização. Sem números fixos.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { REDES } from "@/lib/seed-data";
import { PageHead, KpiCard } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { ChannelSummaryCard } from "@/components/ChannelSummaryCard";
import { fmt, kfmt, sum } from "@/lib/format";
import { daysInMonth, type Period } from "@/lib/scope";

const redeCor = (p: string) =>
  REDES.find((r) => r.id === p || (r.id === "x" && p === "twitter"))?.cor || "#121111";

interface AccountSummary {
  platform: string;
  displayName?: string;
  username?: string;
  followersCount: number | null;
  metrics: Record<string, number>;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// janela de datas a partir do escopo temporal da toolbar (mesma lógica dos painéis de canal)
function dateRange(scope: { period: Period; year: number; month: number; quarter: number; week: number }) {
  const { period, year, month, quarter, week } = scope;
  let since: Date, until: Date;
  if (period === "semana") {
    const last = daysInMonth(year, month);
    const startDay = week * 7 + 1;
    since = new Date(year, month, startDay);
    until = new Date(year, month, Math.min(startDay + 6, last));
  } else if (period === "trimestre") {
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

// cache de módulo (stale-while-revalidate) keyed por since|until
const SUMMARY_CACHE = new Map<string, AccountSummary[]>();

export function PainelView() {
  const s = useStore();
  const storeAccounts = useStore((st) => st.zernioAccounts);
  const range = dateRange(s);
  const cacheKey = `${range.since}|${range.until}`;

  const [accounts, setAccounts] = useState<AccountSummary[] | null>(SUMMARY_CACHE.get(cacheKey) ?? null);
  const [loading, setLoading] = useState(!SUMMARY_CACHE.get(cacheKey));

  useEffect(() => {
    let alive = true;
    const cached = SUMMARY_CACHE.get(cacheKey);
    if (cached) {
      setAccounts(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetch(`/api/zernio/summary?since=${range.since}&until=${range.until}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { accounts?: AccountSummary[] }) => {
        if (!alive) return;
        const list = Array.isArray(d?.accounts) ? d.accounts : [];
        SUMMARY_CACHE.set(cacheKey, list);
        setAccounts(list);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  // baseline p/ empty-state antes do fetch resolver: existe alguma conta social/analytics?
  const hasStoreConnected = storeAccounts.some((a) => a.enabled === true);
  const list = accounts ?? [];
  // ordena por relevância (seguidores desc; sem contagem vai pro fim)
  const ordered = [...list].sort((a, b) => (b.followersCount ?? -1) - (a.followersCount ?? -1));

  // agregados da empresa
  const totalFollowers = sum(list.map((a) => a.followersCount || 0));
  const totalReach = sum(list.map((a) => a.metrics?.reach ?? a.metrics?.impressions ?? 0));
  const totalInter = sum(list.map((a) => a.metrics?.total_interactions ?? 0));
  const anyReach = list.some((a) => a.metrics?.reach != null || a.metrics?.impressions != null);
  const anyInter = list.some((a) => a.metrics?.total_interactions != null);

  const isEmpty = !loading && list.length === 0 && !hasStoreConnected;

  return (
    <>
      <PageHead
        eyebrow="VISÃO GERAL"
        title="Painel"
        desc="Resumo do ambiente — o indicador primário de cada canal conectado, de cara. Conecte suas redes em Personalização para popular os indicadores."
      />

      {isEmpty ? (
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>📡</div>
          <h3>Ambiente sem contas conectadas</h3>
          <p>
            Vá em{" "}
            <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>
              Personalização → Conexões
            </Link>{" "}
            e conecte suas redes. Os painéis passam a mostrar seus dados reais.
          </p>
        </div>
      ) : loading && list.length === 0 ? (
        <Spinner texto="Carregando visão geral…" />
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          {/* KPIs-herói agregados da empresa */}
          <div className="grid kpis">
            <KpiCard lbl="Seguidores (total)" val={totalFollowers ? fmt(totalFollowers) : "—"} foot="somados nas redes" />
            <KpiCard lbl="Canais conectados" val={fmt(list.length)} foot="com dados no período" />
            <KpiCard lbl="Alcance no período" val={anyReach ? kfmt(totalReach) : "—"} foot="soma das redes" />
            <KpiCard lbl="Interações no período" val={anyInter ? kfmt(totalInter) : "—"} foot="engajamento bruto" />
          </div>

          {/* Um card estruturado por canal, ordenado por relevância */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
            {ordered.map((a) => (
              <ChannelSummaryCard
                key={`${a.platform}-${a.username || a.displayName || ""}`}
                platform={a.platform}
                displayName={a.displayName}
                username={a.username}
                followersCount={a.followersCount}
                metrics={a.metrics || {}}
                cor={redeCor(a.platform)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
