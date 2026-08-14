// Gate de administrador da plataforma (superadmin). Server-only.
// Allowlist por e-mail: env ADMIN_EMAILS (vírgula) OU fallback com o dono da agência.
// O painel /admin é read-only (saúde/operação da plataforma) — nunca expõe dado sensível
// de cliente sem necessidade; e a checagem é SEMPRE no servidor.
import { getSessionUser } from "./auth";

function adminList(): string[] {
  const env = process.env.ADMIN_EMAILS;
  const base = env
    ? env.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : ["jose@seahubcoworking.com.br"]; // bootstrap: dono da agência; sobreponha via ADMIN_EMAILS
  return base;
}

export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminList().includes(email.toLowerCase());
}

// usuário admin da sessão, ou null (não logado / sem permissão)
export async function getAdminUser() {
  const u = await getSessionUser();
  if (!u?.email || !isAdminEmail(u.email)) return null;
  return u;
}
