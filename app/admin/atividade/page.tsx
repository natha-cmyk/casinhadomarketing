// /admin/atividade — audit log: quem fez o quê, na plataforma toda.
import { PageHead } from "@/components/ui";
import { adminEvents } from "@/lib/admin-data";

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
};

export default async function AdminAtividade() {
  const events = await adminEvents();
  const dt = (d: Date) => d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Atividade" desc="Quem fez o quê — últimos eventos da plataforma." />
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
