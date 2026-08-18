// Navegação, ícones e mapeamento view↔rota. NAV/META/TEMPORAL portados do blueprint (829-846).

export const ICONS: Record<string, string> = {
  overview: '<path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z"/>',
  ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor"/>',
  leads: '<path d="M4 20v-1c0-2.2 3-3.5 5-3.5s5 1.3 5 3.5v1"/><circle cx="9" cy="8" r="3"/><path d="M15 15c1.7.3 4 1.3 4 3.3V20"/><circle cx="16.5" cy="8.5" r="2.4"/>',
  ads: '<path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8 8 0 0 1 0 12"/>',
  goal: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M8 3v4M16 3v4"/>',
  invoice: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20"/><path d="M12 8.5C12 6 10.5 4.5 9 4.5S6.5 6 8 8.5M12 8.5C12 6 13.5 4.5 15 4.5S17.5 6 16 8.5"/>',
  persona: '<circle cx="12" cy="8.5" r="4"/><path d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5"/>',
  vs: '<path d="M4 6h7M4 12h7M4 18h7"/><path d="M20 6l-3 6 3 6M17 12h-4"/>',
  cfg: '<path d="M9 6a2 2 0 1 0 0 .01M5 6h2M11 6h8M15 12a2 2 0 1 0 0 .01M5 12h8M17 12h2M8 18a2 2 0 1 0 0 .01M5 18h1M10 18h9"/>',
  ext: '<path d="M14 4h6v6M20 4l-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
  upload: '<path d="M12 15V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  tiktok: '<path d="M9.5 12.5a3 3 0 1 0 3 3V7c.8 1.4 2.2 2.3 3.9 2.4"/>',
  linkedin: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M8 10.5V16M8 7.6v.01M11.6 16v-3a2 2 0 0 1 4 0v3"/>',
  youtube: '<rect x="3" y="6" width="18" height="12" rx="3.5"/><path d="M10.5 9.4l4.2 2.6-4.2 2.6z"/>',
  x: '<path d="M4 4l7 9-7 7h2l6-6 4.5 6H21l-7.5-9.5L20 4h-2l-5.5 5.5L8.5 4z"/>',
  facebook: '<path d="M14 8.5h2.2V5.5H14c-1.9 0-3.2 1.4-3.2 3.3V11H9v3h1.8v6h3v-6h2.1l.6-3h-2.7V9c0-.4.3-.5.7-.5"/>',
  threads: '<circle cx="12" cy="12" r="8.5"/><path d="M9 13c0-2 1.3-3.2 3-3.2s3 1 3 3-1.4 3.2-3.2 2.6c-1-.3-1.3-1.4-.6-2.1"/>',
  reddit: '<circle cx="12" cy="13.5" r="6.5"/><circle cx="9.5" cy="13" r=".9" fill="currentColor"/><circle cx="14.5" cy="13" r=".9" fill="currentColor"/><path d="M9.5 16c1.4 1 3.6 1 5 0M15 7l1 3.2M16 6.2a1.2 1.2 0 1 0 0 .02M18.5 12a1.4 1.4 0 1 0 0 .02M5.5 12a1.4 1.4 0 1 0 0 .02"/>',
  pinterest: '<circle cx="12" cy="12" r="8.5"/><path d="M10 18l2.2-8.4M12.2 9.6c0-1.4 1-2.4 2.4-2.4s2.4 1.1 2.4 2.9-1.4 3.4-3.2 3.4c-1 0-1.7-.6-1.7-.6"/>',
  bluesky: '<path d="M12 10.5C10.5 8 7.5 6.2 6 6.5c-1.6.4-1.6 3 .3 5.3 1 1.2 3 2.4 5.7 2.4 2.7 0 4.7-1.2 5.7-2.4 1.9-2.3 1.9-4.9.3-5.3-1.5-.3-4.5 1.5-6 4z"/>',
  snapchat: '<path d="M12 4.5c2.6 0 3.8 2 3.8 4.6 0 .8 0 1.6-.1 2 .5.3 1.2.2 1.7 0 .7-.2 1.1.7.4 1.2-.5.4-1.4.5-1.6 1-.2.6.9 1.6 2 2 .6.2.4 1-.4 1.1-.7 0-1.2.4-1.4.9-.2.5-1 .2-1.7.2s-1.2.6-2.6.6-2-.6-2.6-.6-1.5.3-1.7-.2c-.2-.5-.7-.9-1.4-.9-.8-.1-1-.9-.4-1.1 1.1-.4 2.2-1.4 2-2-.2-.5-1.1-.6-1.6-1-.7-.5-.3-1.4.4-1.2.5.2 1.2.3 1.7 0-.1-.4-.1-1.2-.1-2C8.2 6.5 9.4 4.5 12 4.5z"/>',
  googlebusiness: '<path d="M5 9.5l1.2-4h11.6l1.2 4M5 9.5V19h14V9.5M4.5 9.5h15M6 9.5a2 2 0 0 0 4 0a2 2 0 0 0 4 0a2 2 0 0 0 4 0M9.5 19v-4.5h5V19"/>',
  // ícones dos Assistentes do Panteão (por papel)
  ag_data: '<path d="M4 20V11M9.3 20V5M14.6 20v-7M20 20V8"/>',
  ag_content: '<path d="M4 20h3.5L18 9.5 14.5 6 4 16.5V20Z"/><path d="M13 7.5l3.5 3.5"/>',
  ag_strategy: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 12 12"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><path d="M12 3.5V5M12 19v1.5M3.5 12H5M19 12h1.5"/>',
  ag_crm: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4.2" height="6" rx="1.6"/><rect x="16.8" y="13" width="4.2" height="6" rx="1.6"/>',
  ag_chat: '<path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15H10l-4.5 4V6.5A1.5 1.5 0 0 1 7 5Z"/><circle cx="9.5" cy="10" r=".9" fill="currentColor"/><circle cx="12.5" cy="10" r=".9" fill="currentColor"/><circle cx="15.5" cy="10" r=".9" fill="currentColor"/>',
};

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  live?: boolean;
  title?: string;
  sub?: string;
}
export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { group: "Visão geral", items: [{ id: "overview", label: "Painel", icon: "overview", live: true, title: "Painel" }] },
  {
    group: "Canais",
    items: [
      { id: "instagram", label: "Instagram", icon: "ig", title: "Instagram", sub: "Inside Zuck’s Mind" },
      { id: "tiktok", label: "TikTok", icon: "tiktok", title: "TikTok" },
      { id: "x", label: "X / Twitter", icon: "x", title: "X / Twitter" },
      { id: "facebook", label: "Facebook", icon: "facebook", title: "Facebook" },
      { id: "linkedin", label: "LinkedIn", icon: "linkedin", title: "LinkedIn" },
      { id: "youtube", label: "YouTube", icon: "youtube", title: "YouTube" },
      { id: "threads", label: "Threads", icon: "threads", title: "Threads" },
      { id: "reddit", label: "Reddit", icon: "reddit", title: "Reddit" },
      { id: "pinterest", label: "Pinterest", icon: "pinterest", title: "Pinterest" },
      { id: "bluesky", label: "Bluesky", icon: "bluesky", title: "Bluesky" },
      { id: "snapchat", label: "Snapchat", icon: "snapchat", title: "Snapchat" },
      { id: "googlebusiness", label: "Google Business", icon: "googlebusiness", title: "Google Business" },
    ],
  },
  {
    group: "Comercial",
    items: [
      { id: "canais", label: "Geração por Canais", icon: "leads", live: true, title: "Geração por Canais" },
      { id: "ads", label: "Canais Pagos", icon: "ads", live: true, title: "Performance de Canais Pagos", sub: "Google · Meta · Parceria" },
      { id: "metas", label: "Metas 2026", icon: "goal", live: true, title: "Metas 2026" },
    ],
  },
  { group: "Operação", items: [{ id: "calendario", label: "Calendário", icon: "cal", title: "Calendário de conteúdo" }] },
  {
    group: "Estratégia",
    items: [
      { id: "persona", label: "Persona & Público", icon: "persona", title: "Persona & Público" },
      { id: "concorrencia", label: "Concorrência", icon: "vs", title: "Concorrência" },
    ],
  },
  { group: "Conta", items: [{ id: "assinatura", label: "Assinatura & Indicações", icon: "invoice", live: true, title: "Assinatura & Indicações" }] },
  { group: "Configuração", items: [{ id: "config", label: "Personalização", icon: "cfg", live: true, title: "Personalização" }] },
];

export const META: Record<string, NavItem> = Object.fromEntries(
  NAV.flatMap((g) => g.items).map((i) => [i.id, i])
);

// painéis que respeitam o filtro temporal (janela de data do analytics social).
// Só as redes sociais usam período; nas demais os controles ficam OCULTOS.
export const TEMPORAL = [
  "overview", // Painel (visão geral) — período controlado pela barra de cima, igual aos demais
  "instagram", "tiktok", "x", "facebook", "linkedin", "youtube",
  "threads", "reddit", "pinterest", "bluesky", "snapchat", "googlebusiness",
  "ads", "canais", // Canais Pagos e Geração também usam período
];
export const usesCompare = (v: string) => SOCIAL_IDS.includes(v);

// redes sociais (grupo "Canais") — itens condicionais no sidebar
export const SOCIAL_IDS = [
  "instagram", "tiktok", "x", "facebook", "linkedin", "youtube",
  "threads", "reddit", "pinterest", "bluesky", "snapchat", "googlebusiness",
];

// ── mapeamento view ↔ rota ─────────────────────────────────────
const VIEW_PATH: Record<string, string> = {
  overview: "/",
  instagram: "/instagram",
  canais: "/geracao",
  ads: "/ads",
  metas: "/metas",
  calendario: "/calendario",
  persona: "/persona",
  concorrencia: "/concorrencia",
  config: "/personalizacao",
  assinatura: "/assinatura",
};

export function pathForView(id: string): string {
  if (VIEW_PATH[id]) return VIEW_PATH[id];
  if (SOCIAL_IDS.includes(id)) return "/canal/" + id;
  return "/";
}

export function viewForPath(pathname: string): string {
  if (pathname.startsWith("/canal/")) return pathname.split("/")[2] || "overview";
  const entry = Object.entries(VIEW_PATH).find(([, p]) => p === pathname);
  return entry ? entry[0] : "overview";
}
