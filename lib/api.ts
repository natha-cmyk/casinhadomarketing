// Helpers de rede pra persistência. Tudo tolerante a falha (sem banco → no-op),
// pra app seguir funcionando in-memory com o seed.
import type { UIState } from "./store";
import { useStore } from "./store";

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}
async function putJSON(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    /* sem banco: ignora */
  }
}

export interface HydrationData {
  config: { redes: Record<string, boolean>; paineis: Record<string, Record<string, boolean>>; contas: Record<string, boolean>; cfgOpen: Record<string, boolean>; impOpen: boolean; calManuais?: string[]; calDefaults?: Record<string, string>; calOpcoes?: { pilares?: string[]; formatos?: string[] }; manualStats?: Record<string, { stories?: number; crmCanal?: string }>; agentsConfig?: Record<string, { enabled: boolean; panels: string[] | null; promptExtra: string; name?: string }>; widgetLayout?: Record<string, { order?: string[]; size?: Record<string, number>; height?: Record<string, number>; hidden: string[]; grid?: Record<string, { x: number; y: number; w: number; h: number }> }> } | null;
  perfil: UIState["perfil"] | null;
  okr: { objetivo: string; areas: { id: string; nome: string; krs: { id: string; kr: string; alvo: string; un: string; tag: string; resp: string }[] }[] } | null;
  posts: { posts: UIState["posts"] } | null;
  personas: { personas: UIState["personas"] } | null;
  concorrentes: { concorrentes: UIState["concorrentes"] } | null;
}

export async function fetchAll(): Promise<HydrationData> {
  const [config, perfil, okr, posts, personas, concorrentes] = await Promise.all([
    getJSON<HydrationData["config"]>("/api/config"),
    getJSON<HydrationData["perfil"]>("/api/perfil"),
    getJSON<HydrationData["okr"]>("/api/okr"),
    getJSON<HydrationData["posts"]>("/api/posts"),
    getJSON<HydrationData["personas"]>("/api/personas"),
    getJSON<HydrationData["concorrentes"]>("/api/concorrentes"),
  ]);
  return { config, perfil, okr, posts, personas, concorrentes };
}

export function saveConfig(s: UIState) {
  return putJSON("/api/config", {
    redes: s.redes, paineis: s.paineis, contas: s.contas, cfgOpen: s.cfgOpen, impOpen: s.impOpen,
    adConfig: { manualChannels: s.manualAds, manualCampaigns: s.manualCampaigns, cardOrder: s.cardOrder }, customInd: s.customInd,
    calManuais: s.calManuais, calDefaults: s.calDefaults, calOpcoes: s.calOpcoes, manualStats: s.manualStats, agentsConfig: s.agentsConfig, widgetLayout: s.widgetLayout,
  });
}
export function savePerfil(s: UIState) {
  return putJSON("/api/perfil", s.perfil);
}
export function saveOkr(s: UIState) {
  return putJSON("/api/okr", {
    objetivo: s.okr.objetivo,
    areas: s.okr.areas.map((a) => ({ nome: a.nome, krs: a.krs.map((k) => ({ kr: k.kr, alvo: k.alvo, un: k.un, tag: k.tag, resp: k.resp })) })),
  });
}
export async function savePosts(s: UIState) {
  // lê a resposta pra aplicar remapeamentos de id (quando o servidor teve que criar id novo por
  // colisão com outro workspace) — assim o próximo save não recria o post duplicado.
  try {
    const r = await fetch("/api/posts", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ posts: s.posts }) });
    if (!r.ok) return;
    const data = (await r.json().catch(() => null)) as { remapped?: { from: string; to: string }[] } | null;
    const remapped = data?.remapped;
    if (remapped && remapped.length) {
      const map = new Map(remapped.map((x) => [x.from, x.to]));
      const st = useStore.getState();
      st.set({ posts: st.posts.map((p) => (map.has(p.id) ? { ...p, id: map.get(p.id)! } : p)) });
    }
  } catch {
    /* sem banco: ignora */
  }
}
// exclusão EXPLÍCITA de um post no banco (o único jeito de remover — salvar é só upsert).
export function deletePostApi(id: string) {
  return fetch(`/api/posts?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then((r) => r.ok);
}
export function savePersonas(s: UIState) {
  return putJSON("/api/personas", { personas: s.personas });
}
export function saveConcorrentes(s: UIState) {
  return putJSON("/api/concorrentes", { concorrentes: s.concorrentes });
}
