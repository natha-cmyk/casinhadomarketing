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

// Marca último acesso do usuário — com throttle de 10min (updateMany filtrado = 1 write
// só quando o carimbo está velho; requests paralelos do login viram no-op). Best-effort.
async function touchLastSeen(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  try {
    await prisma.user.updateMany({
      where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: cutoff } }] },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    /* nunca derruba a request */
  }
}

// Workspace ativo do usuário logado (provisiona no 1º acesso). null se não logado.
export async function getActiveWorkspaceId(): Promise<string | null> {
  const user = await getSessionUser();
  if (!user?.email) return null;
  const wsId = await provisionWorkspace(user.id, user.email);
  await touchLastSeen(user.id);
  return wsId;
}

// Registro completo do workspace ativo (inclui zernioProfileId). null se não logado.
export async function getActiveWorkspace() {
  const id = await getActiveWorkspaceId();
  if (!id) return null;
  return prisma.workspace.findUnique({ where: { id } });
}
