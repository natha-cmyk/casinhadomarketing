"use client";
// Painel (overview) por workspace: visão geral RICA de cada canal conectado.
// KPIs-herói agregados da empresa no topo + produção de conteúdo + um card estruturado
// por canal (o mesmo olhar analítico do painel de conta). Respeita o período da toolbar
// (since/until). Empty state preservado: nada conectado → CTA p/ Personalização. Sem números fixos.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { REDES } from "@/lib/seed-data";
import { PageHead, KpiCard } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { ChannelSummaryCard } from "@/components/ChannelSummaryCard";
import { fmt, kfmt, sum } from "@/lib/format";
import { daysInMonth, scopeLabelText, type Period } from "@/lib/scope";

const redeCor = (p: string) =>
  REDES.find((r) => r.id === p || (r.id === "x" && p === "twitter"))?.cor || "#121111";
const redeLabel = (p: string) =>
  REDES.find((r) => r.id === p || (r.id === "x" && p === "twitter"))?.label || p;

interface AccountSummary {
  platform: string;
  displayName?: string;
  username?: string;
  followersCount: number | null;
  metrics: Record<string, number>;
  posts?: number | null; // posts publicados no período (produção de conteúdo)
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
  // rótulo legível do escopo selecionado na toolbar (ex.: "Agosto de 2026"),
  // para deixar EXPLÍCITO de que período são os números do overview.
  const periodoLabel = scopeLabelText({
    period: s.period,
    year: s.year,
    month: s.month,
    week: s.week,
    quarter: s.quarter,
  });
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

  // publica o snapshot do overview (números na tela) p/ os agentes ancorarem — evita invenção
  const setPanelSnapshot = s.setPanelSnapshot;
  useEffect(() => {
    if (!accounts) return;
    setPanelSnapshot({ view: "overview", label: `${range.since} a ${range.until}`, data: { canais: accounts } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, cacheKey]);

  // baseline p/ empty-state antes do fetch resolver: existe alguma conta social/analytics?
  const hasStoreConnected = storeAccounts.some((a) => a.enabled === true);
  const list = accounts ?? [];
  // ordena por relevância (seguidores desc; sem contagem vai pro fim)
  const ordered = [...list].sort((a, b) => (b.followersCount ?? -1) - (a.followersCount ?? -1));

  // agrupa por plataforma: canal com 2+ contas vira um GRANDE WIDGET agrupando as contas
  // (ex. vários Instagrams); canal com 1 conta segue como card individual.
  const groups: { platform: string; accts: typeof ordered }[] = [];
  const gi = new Map<string, number>();
  for (const a of ordered) {
    const idx = gi.get(a.platform);
    if (idx == null) { gi.set(a.platform, groups.length); groups.push({ platform: a.platform, accts: [a] }); }
    else groups[idx].accts.push(a);
  }

  // agregados da empresa
  const totalFollowers = sum(list.map((a) => a.followersCount || 0));
  const totalReach = sum(list.map((a) => a.metrics?.reach ?? a.metrics?.impressions ?? 0));
  const totalInter = sum(list.map((a) => a.metrics?.total_interactions ?? 0));
  const anyReach = list.some((a) => a.metrics?.reach != null || a.metrics?.impressions != null);
  const anyInter = list.some((a) => a.metrics?.total_interactions != null);

  // produção de conteúdo: total de posts publicados no período + breakdown por rede
  const anyPosts = list.some((a) => a.posts != null);
  const totalPosts = sum(list.map((a) => a.posts || 0));
  const postsByRede = list
    .filter((a) => (a.posts ?? 0) > 0)
    .map((a) => ({ platform: a.platform, label: redeLabel(a.platform), cor: redeCor(a.platform), posts: a.posts as number }))
    .sort((a, b) => b.posts - a.posts);

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
          {/* Período analisado — deixa EXPLÍCITO de que janela são todos os números abaixo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              padding: "11px 16px",
              borderRadius: 12,
              background: "color-mix(in srgb, var(--cyan) 8%, #fff)",
              border: "1px solid color-mix(in srgb, var(--cyan) 22%, transparent)",
            }}
          >
            <span
              aria-hidden
              style={{ display: "grid", placeItems: "center", color: "var(--cyan)", flex: "0 0 auto" }}
            >
              📅
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--label-3)", textTransform: "uppercase" }}>
              Período analisado
            </span>
            <span className="tnum" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-.2px", color: "var(--label)" }}>
              {periodoLabel}
            </span>
            <span style={{ fontSize: 12, color: "var(--label-2)", fontWeight: 500 }}>
              — todos os indicadores abaixo são deste período (dados fechados, não “hoje”)
            </span>
          </div>

          {/* KPIs-herói agregados da empresa (no período selecionado) */}
          <div className="grid kpis">
            <KpiCard lbl="Seguidores (total)" val={totalFollowers ? fmt(totalFollowers) : "—"} foot="somados nas redes" />
            <KpiCard lbl="Canais conectados" val={fmt(list.length)} foot="com dados no período" />
            <KpiCard lbl="Alcance no período" val={anyReach ? kfmt(totalReach) : "—"} foot="soma das redes" />
            <KpiCard lbl="Interações no período" val={anyInter ? kfmt(totalInter) : "—"} foot="engajamento bruto" />
          </div>

          {/* Produção de conteúdo — a Casinha também acompanha o que foi publicado */}
          {anyPosts && (
            <div className="card" style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".6px", color: "var(--label-3)", textTransform: "uppercase" }}>
                    Produção de conteúdo <span style={{ color: "var(--label-2)", fontWeight: 600 }}>· {periodoLabel}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                    <span className="tnum" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: "var(--label)" }}>
                      {fmt(totalPosts)}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--label-2)", fontWeight: 500 }}>
                      {totalPosts === 1 ? "post publicado no período" : "posts publicados no período"}
                    </span>
                  </div>
                </div>
              </div>
              {/* mini-breakdown por rede */}
              {postsByRede.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {postsByRede.map((r) => (
                    <span
                      key={r.platform}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "6px 11px 6px 9px",
                        borderRadius: 999,
                        background: `color-mix(in srgb, ${r.cor} 9%, #fff)`,
                        border: `1px solid color-mix(in srgb, ${r.cor} 22%, transparent)`,
                        fontSize: 12.5,
                        color: "var(--label-2)",
                        fontWeight: 500,
                      }}
                    >
                      <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: r.cor, flex: "0 0 8px" }} />
                      {r.label}
                      <span className="tnum" style={{ fontWeight: 700, color: "var(--label)" }}>{fmt(r.posts)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Cards por canal: 1 conta = card individual; 2+ contas = GRANDE WIDGET agrupando */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
            {groups.map((g) =>
              g.accts.length === 1 ? (
                <ChannelSummaryCard
                  key={`${g.platform}-solo`}
                  platform={g.platform}
                  displayName={g.accts[0].displayName}
                  username={g.accts[0].username}
                  followersCount={g.accts[0].followersCount}
                  metrics={g.accts[0].metrics || {}}
                  posts={g.accts[0].posts}
                  cor={redeCor(g.platform)}
                  periodLabel={periodoLabel}
                />
              ) : (
                <div
                  key={`${g.platform}-multi`}
                  style={{
                    gridColumn: "1 / -1",
                    border: `1px solid color-mix(in srgb, ${redeCor(g.platform)} 26%, var(--hairline))`,
                    borderRadius: 16,
                    padding: 16,
                    background: `color-mix(in srgb, ${redeCor(g.platform)} 5%, #fff)`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: redeCor(g.platform), flex: "0 0 auto" }} />
                    <b style={{ fontSize: 15 }}>{redeLabel(g.platform)}</b>
                    <span style={{ fontSize: 12, color: "var(--label-3)", fontWeight: 600 }}>
                      {g.accts.length} contas conectadas · {periodoLabel}
                    </span>
                  </div>
                  <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
                    {g.accts.map((a) => (
                      <ChannelSummaryCard
                        key={`${g.platform}-${a.username || a.displayName || ""}`}
                        platform={a.platform}
                        displayName={a.displayName}
                        username={a.username}
                        followersCount={a.followersCount}
                        metrics={a.metrics || {}}
                        posts={a.posts}
                        cor={redeCor(a.platform)}
                        periodLabel={periodoLabel}
                      />
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
