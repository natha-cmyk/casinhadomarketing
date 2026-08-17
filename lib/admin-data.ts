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
    include: { memberships: { include: { workspace: { include: { perfil: true } } } } },
  });
}

export type AdminWorkspace = Awaited<ReturnType<typeof adminOverview>>["workspaces"][number];
export type AdminUser = Awaited<ReturnType<typeof adminUsers>>[number];

export async function adminEvents(limit = 120) {
  return prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { workspace: { select: { nome: true } } },
  });
}

const DAY = 864e5;
const dayKey = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Série de eventos/dia (últimos `days` dias) — pro gráfico da Visão geral.
export async function adminActivitySeries(days = 14): Promise<{ day: string; count: number }[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } });
  const map = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) map.set(dayKey(new Date(Date.now() - i * DAY)), 0);
  for (const r of rows) {
    const k = dayKey(r.createdAt);
    if (map.has(k)) map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([day, count]) => ({ day, count }));
}

// Atividade por usuário (email): nº de ações registradas nos últimos `days` dias + última ação.
export async function adminUserActivity(days = 30): Promise<Map<string, { count: number; last: Date }>> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.findMany({
    where: { createdAt: { gte: since }, actor: { not: "" } },
    select: { actor: true, createdAt: true },
  });
  const map = new Map<string, { count: number; last: Date }>();
  for (const r of rows) {
    const key = r.actor.toLowerCase();
    const cur = map.get(key);
    if (!cur) map.set(key, { count: 1, last: r.createdAt });
    else { cur.count++; if (r.createdAt > cur.last) cur.last = r.createdAt; }
  }
  return map;
}
