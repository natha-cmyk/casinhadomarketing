import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { provisionWorkspace } from "./provision";

// Usuário da sessão Supabase (ou null).
export async function getSessionUser() {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Workspace ativo do usuário logado (provisiona no 1º acesso). null se não logado.
export async function getActiveWorkspaceId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user?.email) return null;
  return provisionWorkspace(user.id, user.email);
}
