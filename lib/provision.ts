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

  // FAST PATH: já provisionado → retorna sem lock/transação (evita serializar os
  // vários requests paralelos do login e o 5s de espera).
  const fast = await prisma.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (fast) return fast.workspaceId;

  // SLOW PATH (1ª vez): cria com advisory lock (idempotente sob concorrência).
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;

    await tx.user.upsert({ where: { id: userId }, update: { email }, create: { id: userId, email } });

    const existing = await tx.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
    if (existing) return { workspaceId: existing.workspaceId, welcome: false };

    // CONVITE: se há convite pendente pra esse e-mail, ENTRA no workspace que convidou
    // (em vez de criar um novo). Multi-usuário.
    const invite = await tx.invite.findFirst({
      where: { email: email.toLowerCase(), acceptedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (invite) {
      await tx.membership.create({ data: { userId, workspaceId: invite.workspaceId, role: invite.role } });
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return { workspaceId: invite.workspaceId, welcome: false };
    }

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
    return { workspaceId: ws.id, welcome: true };
  });

  // boas-vindas só pra workspace NOVO (self-signup); convidado recebe o e-mail de convite.
  if (result.welcome) {
    const { welcomeEmail } = await import("./email-templates");
    const { sendEmail } = await import("./email");
    const t = welcomeEmail();
    void sendEmail({ to: email, subject: t.subject, html: t.html });
  }
  return result.workspaceId;
}
