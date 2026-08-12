import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
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

// Registro completo do workspace ativo (inclui zernioProfileId). null se não logado.
export async function getActiveWorkspace() {
  const id = await getActiveWorkspaceId();
  if (!id) return null;
  return prisma.workspace.findUnique({ where: { id } });
}
