// Multi-profile por workspace (server-only). A integração limita 1 conta por rede por
// profile; multi-conta = vários profiles. Estes helpers agregam todos os profiles do
// workspace e escolhem o profile-alvo ao conectar uma conta nova.
import type { Workspace } from "@prisma/client";
import { prisma } from "./prisma";
import { listAccounts, createProfile, type ZernioAccount } from "./zernio";

// id da rede (Casinha) → plataforma da integração (só x diverge)
const REDE_TO_PLAT: Record<string, string> = { x: "twitter" };
export const platOf = (redeOrPlat: string) => REDE_TO_PLAT[redeOrPlat] || redeOrPlat;

// todos os profileIds do workspace (primário + extras), sem duplicar
export async function getProfileIds(ws: Workspace): Promise<string[]> {
  const ids = new Set<string>();
  if (ws.zernioProfileId) ids.add(ws.zernioProfileId);
  const rows = await prisma.workspaceProfile.findMany({ where: { workspaceId: ws.id } }).catch(() => []);
  for (const r of rows) ids.add(r.zernioProfileId);
  return [...ids];
}

// contas conectadas de TODOS os profiles do workspace (dedupe por _id)
export async function listWorkspaceAccounts(ws: Workspace): Promise<ZernioAccount[]> {
  const ids = await getProfileIds(ws);
  if (!ids.length) return [];
  const lists = await Promise.all(ids.map((pid) => listAccounts(pid).then((r) => r.accounts).catch(() => [] as ZernioAccount[])));
  const seen = new Set<string>();
  const out: ZernioAccount[] = [];
  for (const arr of lists) for (const a of arr) if (a?._id && !seen.has(a._id)) { seen.add(a._id); out.push(a); }
  return out;
}

// garante que o profile primário do workspace exista + esteja registrado em WorkspaceProfile
export async function ensurePrimaryProfile(ws: Workspace): Promise<string> {
  let primary = ws.zernioProfileId;
  if (!primary) {
    const p = await createProfile(`${ws.nome} · ${ws.id.slice(0, 6)}`);
    primary = p.profile._id;
    await prisma.workspace.update({ where: { id: ws.id }, data: { zernioProfileId: primary } });
  }
  await prisma.workspaceProfile.upsert({
    where: { zernioProfileId: primary },
    create: { workspaceId: ws.id, zernioProfileId: primary, label: "primário" },
    update: {},
  }).catch(() => {});
  return primary;
}

// escolhe o profile-alvo pra conectar `platform`: um profile que AINDA não tem essa rede;
// se todos já têm (ou não há profile livre), cria um novo profile e registra.
export async function targetProfileForConnect(ws: Workspace, platform: string): Promise<string> {
  const plat = platOf(platform);
  await ensurePrimaryProfile(ws);
  const ids = await getProfileIds(ws);

  // mapeia platform já ocupada por profile
  const occupied = new Set<string>();
  await Promise.all(
    ids.map(async (pid) => {
      const accts = await listAccounts(pid).then((r) => r.accounts).catch(() => [] as ZernioAccount[]);
      if (accts.some((a) => String(a.platform) === plat)) occupied.add(pid);
    })
  );
  const free = ids.find((pid) => !occupied.has(pid));
  if (free) return free;

  // todos os profiles já têm essa rede → cria um novo profile pra a conta adicional
  const n = ids.length + 1;
  const p = await createProfile(`${ws.nome} · ${ws.id.slice(0, 6)} · #${n}`);
  await prisma.workspaceProfile.create({ data: { workspaceId: ws.id, zernioProfileId: p.profile._id, label: `perfil ${n}` } }).catch(() => {});
  return p.profile._id;
}
