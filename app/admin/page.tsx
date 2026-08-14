// /admin — Visão geral (saúde/operação da plataforma). Read-only.
import { PageHead, KpiCard } from "@/components/ui";
import { adminOverview } from "@/lib/admin-data";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const { userCount, memCount, workspaces, totals } = await adminOverview();
  const pctConectados = workspaces.length ? Math.round((totals.conectados / workspaces.length) * 100) : 0;
  const topLeads = [...workspaces].filter((w) => w._count.leads > 0).sort((a, b) => b._count.leads - a._count.leads).slice(0, 6);
  const topPosts = [...workspaces].filter((w) => w._count.posts > 0).sort((a, b) => b._count.posts - a._count.posts).slice(0, 6);

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
        <KpiCard lbl="Perfil preenchido" val={fmt(totals.comPerfil)} foot="workspaces" />
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
