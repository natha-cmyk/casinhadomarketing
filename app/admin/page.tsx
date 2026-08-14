// /admin — Painel de Administração da plataforma (superadmin). Server-rendered, gate por
// e-mail admin. READ-ONLY: saúde/operação da plataforma a partir do banco (usuários,
// workspaces, conexões, conteúdo, CRM). Fora do layout do painel do usuário (standalone).
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Casinha do Marketing" };

const CY = "#00BBC5", INK = "#121111", GREEN = "#2FB457", GREY = "#8E8E93";

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ECECEB", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11.5, color: GREY, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: INK, letterSpacing: "-.5px", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: GREY, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default async function AdminPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/");

  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { memberships: true, personas: true, leads: true, posts: true, areas: true, concorrentes: true } },
      crmConfig: true,
      perfil: true,
      memberships: { include: { user: true } },
    },
  });
  const [userCount, memCount] = await Promise.all([prisma.user.count(), prisma.membership.count()]);

  const totals = workspaces.reduce(
    (a, w) => ({
      leads: a.leads + w._count.leads,
      posts: a.posts + w._count.posts,
      personas: a.personas + w._count.personas,
      conectados: a.conectados + (w.zernioProfileId ? 1 : 0),
      crm: a.crm + (w.crmConfig ? 1 : 0),
    }),
    { leads: 0, posts: 0, personas: 0, conectados: 0, crm: 0 }
  );

  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const dt = (d: Date) => d.toLocaleDateString("pt-BR");

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 24px 64px", fontFamily: "Montserrat, system-ui, sans-serif", color: INK }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 11.5, color: CY, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px" }}>Administração da plataforma</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: "2px 0 0" }}>Saúde &amp; operação</h1>
        </div>
        <div style={{ fontSize: 12, color: GREY }}>logado como {admin.email} · <a href="/" style={{ color: CY, fontWeight: 600 }}>voltar ao painel</a></div>
      </div>
      <p style={{ fontSize: 13, color: GREY, margin: "6px 0 22px", maxWidth: 640 }}>
        Visão geral de como a plataforma está sendo usada. Dados reais do banco, somente leitura.
      </p>

      {/* KPIs de saúde */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 26 }}>
        <Kpi label="Usuários" value={fmt(userCount)} />
        <Kpi label="Workspaces" value={fmt(workspaces.length)} sub={`${fmt(totals.conectados)} com canais conectados`} />
        <Kpi label="Vínculos" value={fmt(memCount)} sub="usuário × workspace" />
        <Kpi label="CRM conectado" value={fmt(totals.crm)} sub="workspaces com ClickUp/webhook" />
        <Kpi label="Leads (total)" value={fmt(totals.leads)} />
        <Kpi label="Posts (total)" value={fmt(totals.posts)} />
        <Kpi label="Personas" value={fmt(totals.personas)} />
      </div>

      {/* Workspaces */}
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 10px" }}>Workspaces ({workspaces.length})</h2>
      <div style={{ overflowX: "auto", border: "1px solid #ECECEB", borderRadius: 14, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ textAlign: "left", color: GREY, borderBottom: "1px solid #ECECEB" }}>
              {["Workspace", "Membros", "Canais", "CRM", "Personas", "Leads", "Posts", "OKR", "Criado"].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workspaces.map((w) => (
              <tr key={w.id} style={{ borderBottom: "1px solid #F3F3F2" }}>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700 }}>{w.nome}</div>
                  <div style={{ color: GREY, fontSize: 11 }}>{w.memberships.map((m) => m.user.email).join(", ") || "—"}</div>
                </td>
                <td style={{ padding: "10px 12px" }}>{w._count.memberships}</td>
                <td style={{ padding: "10px 12px" }}>
                  {w.zernioProfileId
                    ? <span style={{ color: GREEN, fontWeight: 700 }}>conectado</span>
                    : <span style={{ color: GREY }}>—</span>}
                </td>
                <td style={{ padding: "10px 12px" }}>{w.crmConfig ? (w.crmConfig.provider || "sim") : "—"}</td>
                <td style={{ padding: "10px 12px" }}>{w._count.personas}</td>
                <td style={{ padding: "10px 12px" }}>{w._count.leads}</td>
                <td style={{ padding: "10px 12px" }}>{w._count.posts}</td>
                <td style={{ padding: "10px 12px" }}>{w._count.areas > 0 ? `${w._count.areas} áreas` : "—"}</td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: GREY }}>{dt(w.createdAt)}</td>
              </tr>
            ))}
            {workspaces.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 20, color: GREY, textAlign: "center" }}>Nenhum workspace ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Comunicação — honesto sobre o que existe e o que falta construir */}
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "28px 0 10px" }}>Comunicação &amp; pontos de contato</h2>
      <div style={{ background: "#fff", border: "1px solid #ECECEB", borderRadius: 14, padding: 18, fontSize: 13, color: "#3a3a3a", lineHeight: 1.6 }}>
        <p style={{ margin: "0 0 8px" }}>
          <b>Hoje (via Supabase Auth):</b> e-mails automáticos de <b>redefinição de senha</b> e <b>magic link / confirmação de cadastro</b>. Não há, ainda, cadência de marketing/onboarding própria.
        </p>
        <p style={{ margin: 0, color: GREY }}>
          <b>A construir (roadmap):</b> registro de cada ponto de contato (boas-vindas, ao conectar uma conta, resumos periódicos), régua de e-mails configurável e log de envios por usuário — precisa de uma camada de comunicação/eventos (provedor de e-mail + tabela de eventos). Quando priorizado, entra aqui.
        </p>
      </div>

      <p style={{ fontSize: 11.5, color: GREY, marginTop: 20 }}>
        Contagem de contas conectadas ao vivo por workspace ainda não aparece aqui (exige consulta à integração por workspace / cache) — mostrado como “conectado” pelo perfil. Próximo incremento.
      </p>
    </div>
  );
}
