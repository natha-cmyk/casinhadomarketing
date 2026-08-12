import { prisma } from "@/lib/prisma";
import { createProfile } from "@/lib/zernio";

// Emails que representam a Seahub → reaproveitam o profile Zernio "Default"
// (que já tem IG/FB/Meta Ads conectados). Demais cadastros ganham profile novo.
const SEAHUB_EMAILS = ["jose@seahubcoworking.com.br"];

// Garante User + Workspace + profile Zernio + Membership + ambiente vazio.
// Idempotente: se já existe membership, retorna o workspace.
export async function provisionWorkspace(userId: string, email: string): Promise<string> {
  await prisma.user.upsert({
    where: { id: userId },
    update: { email },
    create: { id: userId, email },
  });

  const existing = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.workspaceId;

  const isSeahub = SEAHUB_EMAILS.includes(email.toLowerCase());
  const nome = isSeahub ? "Seahub" : email.split("@")[0];

  // profile Zernio: Seahub reaproveita o Default; demais criam um novo (tolerante a falha)
  let zernioProfileId: string | null = null;
  if (isSeahub && process.env.ZERNIO_PROFILE_ID) {
    zernioProfileId = process.env.ZERNIO_PROFILE_ID;
  } else if (process.env.ZERNIO_API_KEY) {
    try {
      const p = await createProfile(`${nome} · ${userId.slice(0, 6)}`);
      zernioProfileId = p.profile._id;
    } catch {
      zernioProfileId = null; // liga depois; workspace não fica bloqueado
    }
  }

  const ws = await prisma.workspace.create({
    data: {
      nome,
      zernioProfileId,
      memberships: { create: { userId, role: "owner" } },
      envConfig: { create: {} },
      perfil: { create: { empresa: isSeahub ? "Seahub Coworking" : "" } },
      objetivo: { create: {} },
    },
  });
  return ws.id;
}
