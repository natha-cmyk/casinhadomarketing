// /admin/atividade — audit log + frequência de uso por usuário (último acesso + ações 30d).
import { PageHead } from "@/components/ui";
import { adminEvents, adminUsers, adminUserActivity } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

const TH: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap", color: "var(--label-3)" };
const TD: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top" };

// tipo do evento → rótulo PT
const LABEL: Record<string, string> = {
  "post.published": "Publicou post",
  "post.scheduled": "Agendou post",
  "onboarding.completed": "Concluiu onboarding",
  "llm.connected": "Conectou LLM",
  "crm.connected": "Conectou CRM",
  "crm.configured": "Configurou CRM",
  "crm.synced": "Sincronizou CRM",
  "persona.updated": "Editou personas",
  "okr.updated": "Editou metas/OKR",
};

// ativo = visto nos últimos 7 dias (helper de módulo p/ não chamar Date.now() no render)
const isRecent = (d: Date | null | undefined, dias = 7) => !!d && Date.now() - d.getTime() < dias * 864e5;

const rel = (d: Date | null | undefined) => {
  if (!d) return "nunca";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias} d`;
  return d.toLocaleDateString("pt-BR");
};

export default async function AdminAtividade() {
  const [events, users, activity] = await Promise.all([adminEvents(), adminUsers(), adminUserActivity(30)]);
  const dt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  // frequência por usuário — ordena por último acesso (mais recente primeiro)
  const freq = users
    .map((u) => ({
      email: u.email,
      nome: u.nome,
      lastSeen: u.lastSeenAt,
      acoes: activity.get(u.email.toLowerCase())?.count ?? 0,
    }))
    .sort((a, b) => (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0));
  const ativos7 = freq.filter((f) => isRecent(f.lastSeen)).length;

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Atividade" desc={`${ativos7} usuário(s) ativo(s) nos últimos 7 dias.`} />

      {/* ===== Frequência de uso por usuário ===== */}
      <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 18 }}>
        <div style={{ padding: "14px 16px 4px", fontSize: 13.5, fontWeight: 700 }}>
          Frequência de uso <span style={{ color: "var(--label-3)", fontWeight: 600, fontSize: 12 }}>· último acesso e ações registradas (30d)</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--hairline)" }}>
              <th style={TH}>Usuário</th>
              <th style={TH}>Último acesso</th>
              <th style={TH}>Ações 30d</th>
            </tr>
          </thead>
          <tbody>
            {freq.map((f) => {
              const ativo = isRecent(f.lastSeen);
              return (
                <tr key={f.email} style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <td style={{ ...TD, fontWeight: 600 }}>
                    {f.email}
                    {f.nome ? <span style={{ color: "var(--label-3)", fontWeight: 400 }}> · {f.nome}</span> : null}
                  </td>
                  <td style={{ ...TD, whiteSpace: "nowrap", color: ativo ? "var(--excelente,#2FB457)" : "var(--label-2)", fontWeight: ativo ? 700 : 400 }}>
                    {rel(f.lastSeen)}
                  </td>
                  <td style={{ ...TD, fontWeight: 700 }}>{f.acoes}</td>
                </tr>
              );
            })}
            {freq.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 20, color: "var(--label-3)", textAlign: "center" }}>Nenhum usuário ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== Log de eventos ===== */}
      <div style={{ fontSize: 13.5, fontWeight: 700, margin: "0 2px 10px" }}>Últimos eventos</div>
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--hairline)" }}>
              <th style={TH}>Quando</th>
              <th style={TH}>Workspace</th>
              <th style={TH}>Quem</th>
              <th style={TH}>Ação</th>
              <th style={TH}>Alvo</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                <td style={{ ...TD, whiteSpace: "nowrap", color: "var(--label-2)" }}>{dt(e.createdAt)}</td>
                <td style={{ ...TD, fontWeight: 600 }}>{e.workspace.nome}</td>
                <td style={TD}>{e.actor || <span style={{ color: "var(--label-3)" }}>—</span>}</td>
                <td style={TD}>{LABEL[e.type] || e.type}</td>
                <td style={{ ...TD, color: "var(--label-2)" }}>{e.target || "—"}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 20, color: "var(--label-3)", textAlign: "center" }}>Nenhum evento registrado ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
