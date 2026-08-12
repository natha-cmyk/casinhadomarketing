import { prisma } from "@/lib/prisma";

// Emails que representam a Seahub → reaproveitam o profile Zernio "Default"
// (se ZERNIO_PROFILE_ID estiver setado). Demais criam profile sob demanda no /connect.
const SEAHUB_EMAILS = (process.env.SEAHUB_EMAILS || "seahub@seahubcoworking.page")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Garante User + Workspace + Membership + ambiente vazio. IDEMPOTENTE mesmo sob
// concorrência (o Hydrator dispara vários requests no 1º login) — usa advisory lock
// por usuário. O profile Zernio é criado sob demanda no /api/zernio/connect.
export async function provisionWorkspace(userId: string, email: string): Promise<string> {
  const isSeahub = SEAHUB_EMAILS.includes(email.toLowerCase());
  return prisma.$transaction(async (tx) => {
    // serializa o provisionamento concorrente deste usuário
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

    await tx.user.upsert({ where: { id: userId }, update: { email }, create: { id: userId, email } });

    const existing = await tx.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (existing) return existing.workspaceId;

    const zernioProfileId = isSeahub && process.env.ZERNIO_PROFILE_ID ? process.env.ZERNIO_PROFILE_ID : null;
    const ws = await tx.workspace.create({
      data: {
        nome: isSeahub ? "Seahub" : email.split("@")[0],
        zernioProfileId,
        memberships: { create: { userId, role: "owner" } },
        envConfig: { create: {} },
        perfil: { create: { empresa: isSeahub ? "Seahub Coworking" : "" } },
        objetivo: { create: {} },
      },
    });
    return ws.id;
  });
}
