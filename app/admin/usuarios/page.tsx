// /admin/usuarios — usuários cadastrados. Cada card expande (clicável) e mostra
// os workspaces do usuário com o Perfil (ramo/telefone/email/cidade), último acesso
// e frequência de uso (ações registradas nos últimos 30 dias).
import { PageHead } from "@/components/ui";
import { adminUsers, adminUserActivity } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

// ativo = visto nos últimos 7 dias (helper de módulo p/ não chamar Date.now() no render)
const isRecent = (d: Date | null | undefined, dias = 7) => !!d && Date.now() - d.getTime() < dias * 864e5;

const rel = (d: Date | null | undefined) => {
  if (!d) return "nunca";
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias} d`;
  return d.toLocaleDateString("pt-BR");
};

export default async function AdminUsers() {
  const [users, activity] = await Promise.all([adminUsers(), adminUserActivity(30)]);

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Usuários" desc={`${users.length} usuário(s) cadastrado(s) — clique para ver detalhes.`} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {users.map((u) => {
          const owner = u.memberships.some((m) => m.role === "owner");
          const act = activity.get(u.email.toLowerCase());
          const ativo = isRecent(u.lastSeenAt);
          return (
            <details key={u.id} className="card" style={{ padding: 0 }}>
              <summary
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer",
                  listStyle: "none", flexWrap: "wrap",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 34, height: 34, borderRadius: "50%", flex: "0 0 34px", display: "grid", placeItems: "center",
                    background: "var(--cream)", fontWeight: 800, fontSize: 13, color: "var(--ink)",
                  }}
                >
                  {(u.nome || u.email).slice(0, 1).toUpperCase()}
                </span>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                  <div style={{ fontSize: 12, color: "var(--label-3)" }}>{u.nome || "sem nome"}</div>
                </div>
                <span className="pill" style={{ background: owner ? "rgba(0,187,197,.12)" : "var(--cream)", color: owner ? "var(--cyan)" : "var(--label-2)", fontWeight: 700, fontSize: 11, padding: "3px 9px", borderRadius: 999 }}>
                  {owner ? "owner" : "member"}
                </span>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: ativo ? "var(--excelente)" : "var(--label-2)" }}>{rel(u.lastSeenAt)}</div>
                  <div style={{ fontSize: 11, color: "var(--label-3)" }}>último acesso</div>
                </div>
                <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                  <div className="tnum" style={{ fontSize: 12.5, fontWeight: 700 }}>{act?.count ?? 0}</div>
                  <div style={{ fontSize: 11, color: "var(--label-3)" }}>ações 30d</div>
                </div>
              </summary>

              <div style={{ borderTop: "1px solid var(--hairline)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontSize: 12.5 }}>
                  <Meta lbl="Cadastro" val={u.createdAt.toLocaleDateString("pt-BR")} />
                  <Meta lbl="Última ação" val={act ? rel(act.last) : "—"} />
                  <Meta lbl="Workspaces" val={String(u.memberships.length)} />
                </div>

                {u.memberships.length ? (
                  u.memberships.map((m) => {
                    const p = m.workspace.perfil;
                    return (
                      <div key={m.id} style={{ border: "1px solid var(--hairline)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                          {m.workspace.nome} <span style={{ fontWeight: 400, color: "var(--label-3)", fontSize: 11 }}>· {m.role}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "8px 18px" }}>
                          <Meta lbl="Empresa" val={p?.empresa || "—"} />
                          <Meta lbl="Ramo" val={p?.ramo || "—"} />
                          <Meta lbl="Telefone" val={p?.telefone || "—"} />
                          <Meta lbl="E-mail contato" val={p?.emailContato || "—"} />
                          <Meta lbl="Cidade/UF" val={p ? [p.cidade, p.estado].filter(Boolean).join("/") || "—" : "—"} />
                          <Meta lbl="Site" val={p?.site || "—"} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--label-3)" }}>Sem workspace vinculado.</div>
                )}
              </div>
            </details>
          );
        })}
        {users.length === 0 && (
          <div className="card" style={{ padding: 20, color: "var(--label-3)", textAlign: "center" }}>Nenhum usuário ainda.</div>
        )}
      </div>
    </>
  );
}

function Meta({ lbl, val }: { lbl: string; val: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--label-3)" }}>{lbl}</div>
      <div style={{ fontSize: 12.5, color: "var(--label)", wordBreak: "break-word" }}>{val}</div>
    </div>
  );
}
