// /admin/usuarios — usuários cadastrados + workspaces a que pertencem.
import { PageHead } from "@/components/ui";
import { adminUsers } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

const TH: React.CSSProperties = { padding: "10px 14px", fontWeight: 600, whiteSpace: "nowrap", color: "var(--label-3)" };
const TD: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top" };

export default async function AdminUsers() {
  const users = await adminUsers();
  const dt = (d: Date) => d.toLocaleDateString("pt-BR");

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Usuários" desc={`${users.length} usuário(s) cadastrado(s).`} />
      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--hairline)" }}>
              <th style={TH}>E-mail</th>
              <th style={TH}>Nome</th>
              <th style={TH}>Workspaces</th>
              <th style={TH}>Papel</th>
              <th style={TH}>Cadastro</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const owner = u.memberships.some((m) => m.role === "owner");
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--hairline)" }}>
                  <td style={{ ...TD, fontWeight: 600 }}>{u.email}</td>
                  <td style={TD}>{u.nome || <span style={{ color: "var(--label-3)" }}>—</span>}</td>
                  <td style={TD}>
                    {u.memberships.length
                      ? u.memberships.map((m) => m.workspace.nome).join(", ")
                      : <span style={{ color: "var(--label-3)" }}>nenhum</span>}
                  </td>
                  <td style={TD}>
                    <span style={{ fontWeight: 700, color: owner ? "var(--cyan)" : "var(--label-2)" }}>{owner ? "owner" : "member"}</span>
                  </td>
                  <td style={{ ...TD, whiteSpace: "nowrap", color: "var(--label-2)" }}>{dt(u.createdAt)}</td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 20, color: "var(--label-3)", textAlign: "center" }}>Nenhum usuário ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
