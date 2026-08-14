// Consultas agregadas do painel Admin (server-only, read-only). Saúde/operação da
// plataforma a partir do banco. Nenhuma escrita.
import { prisma } from "./prisma";

export async function adminOverview() {
  const [userCount, memCount, workspaces] = await Promise.all([
    prisma.user.count(),
    prisma.membership.count(),
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { memberships: true, personas: true, leads: true, posts: true, areas: true, concorrentes: true } },
        crmConfig: true,
        perfil: true,
        memberships: { include: { user: true } },
      },
    }),
  ]);
  const totals = workspaces.reduce(
    (a, w) => ({
      leads: a.leads + w._count.leads,
      posts: a.posts + w._count.posts,
      personas: a.personas + w._count.personas,
      conectados: a.conectados + (w.zernioProfileId ? 1 : 0),
      crm: a.crm + (w.crmConfig ? 1 : 0),
      comPerfil: a.comPerfil + (w.perfil ? 1 : 0),
    }),
    { leads: 0, posts: 0, personas: 0, conectados: 0, crm: 0, comPerfil: 0 }
  );
  return { userCount, memCount, workspaces, totals };
}

export async function adminUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { memberships: { include: { workspace: true } } },
  });
}

export type AdminWorkspace = Awaited<ReturnType<typeof adminOverview>>["workspaces"][number];
