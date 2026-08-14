// Audit log — registra um evento (quem fez o quê). Fire-and-forget: NUNCA lança
// (falha de log não pode quebrar a ação real). Server-only.
import { prisma } from "./prisma";
import { getSessionUser } from "./auth";

export async function logEvent(
  workspaceId: string,
  type: string,
  target = "",
  meta: Record<string, unknown> = {}
): Promise<void> {
  try {
    const u = await getSessionUser();
    await prisma.event.create({
      data: { workspaceId, actor: u?.email || "", type, target, meta: meta as object },
    });
  } catch {
    /* log não pode quebrar a ação */
  }
}
