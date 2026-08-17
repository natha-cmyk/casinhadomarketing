// /admin — Visão geral (saúde/operação da plataforma). Read-only.
import { PageHead, KpiCard } from "@/components/ui";
import { adminOverview, adminActivitySeries } from "@/lib/admin-data";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [{ userCount, memCount, workspaces, totals }, series] = await Promise.all([
    adminOverview(),
    adminActivitySeries(14),
  ]);
  const pctConectados = workspaces.length ? Math.round((totals.conectados / workspaces.length) * 100) : 0;
  const topLeads = [...workspaces].filter((w) => w._count.leads > 0).sort((a, b) => b._count.leads - a._count.leads).slice(0, 6);
  const topPosts = [...workspaces].filter((w) => w._count.posts > 0).sort((a, b) => b._count.posts - a._count.posts).slice(0, 6);
  const ativos14 = series.reduce((a, s) => a + s.count, 0);

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Visão geral" desc="Saúde e operação da plataforma — dados reais do banco, somente leitura." />

      <div className="grid kpis">
        <KpiCard lbl="Usuários" val={fmt(userCount)} foot="cadastrados" />
        <KpiCard lbl="Workspaces" val={fmt(workspaces.length)} foot={`${pctConectados}% com canais conectados`} />
        <KpiCard lbl="Vínculos" val={fmt(memCount)} foot="usuário × workspace" />
        <KpiCard lbl="CRM conectado" val={fmt(totals.crm)} foot="workspaces com CRM" />
      </div>
      <div className="grid kpis" style={{ marginTop: 16 }}>
        <KpiCard lbl="Leads (total)" val={fmt(totals.leads)} foot="somados" />
        <KpiCard lbl="Posts (total)" val={fmt(totals.posts)} foot="calendário" />
        <KpiCard lbl="Personas" val={fmt(totals.personas)} foot="cadastradas" />
        <KpiCard lbl="Ações 14d" val={fmt(ativos14)} foot="eventos registrados" />
      </div>

      {/* ===== Atividade da plataforma (eventos/dia, 14 dias) ===== */}
      <div className="card" style={{ padding: "18px 20px", marginTop: 18 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Atividade da plataforma</div>
        <div style={{ fontSize: 12, color: "var(--label-3)", marginBottom: 14 }}>Eventos registrados por dia — últimos 14 dias.</div>
        <ActivityBars series={series} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginTop: 18 }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Workspaces com mais leads</div>
          {topLeads.length ? topLeads.map((w) => (
            <Row key={w.id} nome={w.nome} val={fmt(w._count.leads)} />
          )) : <Empty />}
        </div>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Workspaces com mais posts</div>
          {topPosts.length ? topPosts.map((w) => (
            <Row key={w.id} nome={w.nome} val={fmt(w._count.posts)} />
          )) : <Empty />}
        </div>
      </div>
    </>
  );
}

// Barras verticais (SVG puro, server-rendered). Hoje em destaque; dias sem evento ficam hairline.
function ActivityBars({ series }: { series: { day: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const W = 640, H = 140, pad = 22, n = series.length;
  const bw = (W - pad * 2) / n;
  const barW = Math.min(26, bw * 0.62);
  const todayKey = series[series.length - 1]?.day;
  const wd = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 420, height: "auto", display: "block" }}>
        <line x1={pad} y1={H - 20} x2={W - pad} y2={H - 20} stroke="var(--hairline)" strokeWidth={1} />
        {series.map((s, i) => {
          const x = pad + bw * i + (bw - barW) / 2;
          const h = s.count ? Math.max(3, ((H - 40) * s.count) / max) : 2;
          const y = H - 20 - h;
          const isToday = s.day === todayKey;
          return (
            <g key={s.day}>
              <rect x={x} y={y} width={barW} height={h} rx={4}
                fill={s.count ? (isToday ? "var(--red)" : "var(--cyan)") : "var(--hairline)"} />
              {s.count > 0 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--label-2)">{s.count}</text>
              )}
              {(i % 2 === 0 || isToday) && (
                <text x={x + barW / 2} y={H - 7} textAnchor="middle" fontSize={8.5} fill="var(--label-3)">{wd(s.day)}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Row({ nome, val }: { nome: string; val: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--hairline)" }}>
      <span style={{ fontSize: 13, color: "var(--label)" }}>{nome}</span>
      <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{val}</span>
    </div>
  );
}
function Empty() {
  return <div style={{ fontSize: 12.5, color: "var(--label-3)" }}>Sem dados ainda.</div>;
}
