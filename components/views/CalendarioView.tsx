"use client";
// Porta viewCalendario (blueprint 1445-1474) + helpers contaChip/filaRow/postMatch/postChip/
// contentMonthGrid (1417-1444) + feriadosMoveis/feriadosLista (662-663). Estética mLabs.
import { useEffect, useState } from "react";
import { useStore, type PostItem } from "@/lib/store";
import {
  CANAL_POST_COLORS,
  FERIADOS,
  EVENTOS,
  FER_NAC,
  FER_UF,
  REDES,
} from "@/lib/seed-data";
import { MONTHS_FULL, daysInMonth } from "@/lib/scope";
import { PageHead } from "@/components/ui";
import { Ic } from "@/components/Ic";
import { ConexoesGrid } from "@/components/ConexoesGrid";
import { PostModal } from "./PostModal";
import { BibliotecaPanel } from "./BibliotecaPanel";
import { savePosts, deletePostApi } from "@/lib/api";

// ícone (nome em ICONS) e COR DE MARCA por canal — usados na apresentação como ponto de identificação.
const CANAL_ICONE: Record<string, string> = {
  Instagram: "ig", TikTok: "tiktok", "X / Twitter": "x", Facebook: "facebook", LinkedIn: "linkedin",
  YouTube: "youtube", Threads: "threads", Reddit: "reddit", Pinterest: "pinterest", Bluesky: "bluesky",
  Snapchat: "snapchat", "Google Business": "googlebusiness",
};
const CANAL_MARCA: Record<string, string> = {
  Instagram: "#E1306C", TikTok: "#111111", "X / Twitter": "#111111", Facebook: "#1877F2", LinkedIn: "#0A66C2",
  YouTube: "#FF0000", Threads: "#111111", Reddit: "#FF4500", Pinterest: "#E60023", Bluesky: "#1185FE",
  Snapchat: "#111111", "Google Business": "#4285F4",
  "WhatsApp (grupos)": "#25D366", "Lista de transmissão": "#00BBC5", Blog: "#8E5BE0",
};
const iconeCanal = (nome: string) => CANAL_ICONE[nome] || "";
const corMarca = (nome: string, fallback: string) => CANAL_MARCA[nome] || fallback;

// plataforma Zernio → id da rede (Casinha): twitter → x
const PLAT_REV: Record<string, string> = { twitter: "x" };

// Canais manuais de conteúdo agora são gerenciados pelo usuário (store.calManuais).
// NÃO são contas conectadas: só registro de conteúdo, sem publicação síncrona.

type ZAccount = {
  platform: string;
  displayName?: string;
  username?: string;
  enabled?: boolean;
  adsStatus?: string;
};

// id da rede (Casinha) de uma conta Zernio (twitter→x).
const redeIdOf = (a: ZAccount) => PLAT_REV[a.platform] || a.platform;

// Nome do perfil de uma conta (displayName/username, com fallback).
function nomePerfil(a: ZAccount): string {
  const rede = REDES.find((r) => r.id === redeIdOf(a));
  return (a.displayName || a.username || rede?.label || a.platform || "").trim();
}

// Contas SOCIAIS realmente conectadas = enabled === true e a rede não é "ads".
// (contas ads-only entram como enabled:false e NÃO são canais de publicação.)
function contasSociais(accounts: ZAccount[]): ZAccount[] {
  return accounts.filter((a) => {
    if (a.enabled !== true) return false;
    const rede = REDES.find((r) => r.id === redeIdOf(a));
    return !!rede && rede.grupo !== "ads";
  });
}

// Redes REALMENTE conectadas (social/conversas) — só as com conta habilitada (twitter→x).
function redesConectadas(accounts: ZAccount[]): (typeof REDES)[number][] {
  const ids = Array.from(new Set(contasSociais(accounts).map(redeIdOf)));
  return ids
    .map((id) => REDES.find((r) => r.id === id))
    .filter((r): r is (typeof REDES)[number] => !!r);
}

// Canais = redes REALMENTE conectadas + canais MANUAIS do usuário. Cada um com sua cor.
function canaisConectados(accounts: ZAccount[], manuais: string[]): { nome: string; cor: string; manual?: boolean }[] {
  const redes = redesConectadas(accounts).map((r) => ({ nome: r.label, cor: r.cor }));
  const man = manuais.map((nome) => ({ nome, cor: CANAL_POST_COLORS[nome] || "#8E8E93", manual: true }));
  return [...redes, ...man];
}

// Perfis conectados = um por conta social habilitada (displayName/username). Multi-conta.
function perfisConectados(accounts: ZAccount[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of contasSociais(accounts)) {
    const nome = nomePerfil(a);
    if (!nome || seen.has(nome)) continue;
    seen.add(nome);
    out.push(nome);
  }
  return out;
}

// Perfis do canal selecionado (por label da rede). "todos" → todos os conectados.
// Canal manual (WhatsApp/Blog/Lista) não tem contas → [].
function perfisDoCanal(accounts: ZAccount[], canalNome: string): string[] {
  if (canalNome === "todos") return perfisConectados(accounts);
  const rede = REDES.find((r) => r.label === canalNome);
  if (!rede) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of contasSociais(accounts)) {
    if (redeIdOf(a) !== rede.id) continue;
    const nome = nomePerfil(a);
    if (!nome || seen.has(nome)) continue;
    seen.add(nome);
    out.push(nome);
  }
  return out;
}

const POST_STATUS: Record<string, { label: string; cor: string }> = {
  rascunho: { label: "Rascunho", cor: "#8E8E93" },
  agendado: { label: "Agendado", cor: "#00BBC5" },
  publicado: { label: "Publicado", cor: "#2FB457" }, // verde = saiu OK
  falhou: { label: "Erro ao publicar", cor: "#FF9F0A" }, // amarelo = deu erro
  cancelado: { label: "Cancelado / impedido", cor: "#FF001E" }, // vermelho = não vai sair
};

const calKey = (y: number, m: number, d: number) => y + "-" + (m + 1) + "-" + d;

// ── Modo apresentação ──────────────────────────────────────────────
const WD_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type ApPeriodo = "mes" | "quinzena" | "semana" | "custom";
// Janelas [diaInicio, diaFim] dentro do mês, conforme o período escolhido.
function apWindows(periodo: ApPeriodo, year: number, month: number): [number, number][] {
  const dim = daysInMonth(year, month);
  if (periodo === "mes") return [[1, dim]];
  if (periodo === "quinzena") return dim > 15 ? [[1, 15], [16, dim]] : [[1, dim]];
  // semana FIXA por data do mês (padrão Casinha): W1 1–7, W2 8–14, W3 15–21, W4 22–fim.
  const bounds: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, dim]];
  return bounds.filter(([a]) => a <= dim).map(([a, b]) => [a, Math.min(b, dim)] as [number, number]);
}
// número da semana Casinha (W1–W4) a partir do dia inicial da janela.
function semanaNum(diaInicio: number): number {
  return Math.min(4, Math.floor((diaInicio - 1) / 7) + 1);
}
function apWindowLabel(periodo: ApPeriodo, win: [number, number], month: number): string {
  const mes = MONTHS_FULL[month];
  if (periodo === "mes") return mes;
  if (periodo === "custom") return `${win[0]}–${win[1]} de ${mes}`;
  if (periodo === "quinzena") return `${win[0]}–${win[1]} de ${mes}`;
  return `Semana ${semanaNum(win[0])} (W${semanaNum(win[0])}) · ${win[0]}–${win[1]} de ${mes}`;
}

// feriados móveis do ano (Carnaval, Sexta-feira Santa, Corpus Christi) → [dd/mm, nome]
function feriadosMoveis(y: number): [string, string][] {
  return Object.entries(FERIADOS)
    .filter(([k, v]) => k.startsWith(y + "-") && ["Carnaval", "Sexta-feira Santa", "Corpus Christi"].includes(v))
    .map(([k, v]) => {
      const p = k.split("-");
      return [String(p[2]).padStart(2, "0") + "/" + String(p[1]).padStart(2, "0"), v] as [string, string];
    });
}
function feriadosLista(y: number, uf: string): [string, string][] {
  let l: [string, string][] = FER_NAC.concat(feriadosMoveis(y));
  if (uf !== "Nacional" && FER_UF[uf]) l = l.concat(FER_UF[uf].map((x) => [x[0], x[1] + " · " + uf] as [string, string]));
  return l.sort((a, b) => {
    const A = a[0].split("/").map(Number);
    const B = b[0].split("/").map(Number);
    return A[1] - B[1] || A[0] - B[0];
  });
}

export function CalendarioView() {
  const s = useStore();
  const {
    posts,
    zernioAccounts,
    calCanal,
    calPerfil,
    calCV,
    calMonth: month,
    calYear: year,
    set,
    updatePost,
    addPost,
    deletePost,
  } = s;

  // Fonte única (auto-sincroniza quando novas contas conectam) + manuais do usuário:
  const canais = canaisConectados(zernioAccounts, s.calManuais);
  const canalCor = (nome: string) =>
    canais.find((c) => c.nome === nome)?.cor ?? CANAL_POST_COLORS[nome] ?? "#8E8E93";

  // Perfis no escopo do canal selecionado. O seletor de perfil só aparece quando há
  // MULTI-CONTA (2+ perfis no escopo): canal específico com 2+ contas da mesma rede,
  // ou "todos os canais" com 2+ perfis conectados. Com 1 conta é redundante → some.
  const perfis = perfisDoCanal(zernioAccounts, calCanal);
  const mostrarPerfil = perfis.length >= 2;
  const perfisKey = perfis.join("|");

  // Quando o seletor some (ou o perfil atual sai do escopo), volta para "todos".
  useEffect(() => {
    if (!mostrarPerfil) {
      if (calPerfil !== "todos") set({ calPerfil: "todos" });
    } else if (calPerfil !== "todos" && !perfis.includes(calPerfil)) {
      set({ calPerfil: "todos" });
    }
    // perfisKey cobre mudanças no conteúdo de `perfis` sem instabilidade de referência
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarPerfil, calPerfil, perfisKey, set]);

  // Escape fecha o modal (blueprint 1880).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().postModal) set({ postModal: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  const postMatch = (p: PostItem) => {
    if (calCanal !== "todos" && p.canal !== calCanal) return false;
    if (calPerfil !== "todos" && p.perfil !== calPerfil && p.colab !== calPerfil) return false;
    if (calCV !== "todos" && p.status !== calCV) return false;
    return true;
  };

  const postChip = (p: PostItem) => {
    const st = POST_STATUS[p.status] || POST_STATUS.rascunho;
    const c = corMarca(p.canal, canalCor(p.canal));
    const ico = iconeCanal(p.canal);
    const nc = (p.contas || []).length;
    const acc = nc ? ` → ${nc} ${nc === 1 ? "canal" : "canais"}` : "";
    // norteador (hover): canal · pilar · funil · título completo
    const norteador = [p.canal, p.pilar, p.funil].filter(Boolean).join(" · ");
    const fBadge = p.funil ? p.funil[0].toUpperCase() : ""; // T/M/F
    const marcado = batchMode && sel.has(p.id);
    return (
      <button
        key={p.id}
        className={`post-chip st-${p.status}`}
        data-post={p.id}
        draggable={!batchMode}
        style={marcado ? { boxShadow: "0 0 0 2px var(--cyan)", background: "color-mix(in srgb, var(--cyan) 12%, transparent)" } : undefined}
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData("text/plain", p.id); e.dataTransfer.effectAllowed = "move"; }}
        title={batchMode
          ? `${p.titulo || "(sem título)"} — clique pra ${marcado ? "desmarcar" : "marcar"}`
          : `${p.titulo || "(sem título)"}\n${norteador} · ${st.label}${acc}\n(arraste pra outro dia pra remarcar)`}
        onClick={(e) => {
          e.stopPropagation();
          if (batchMode) { toggleSel(p.id); return; }
          set({ postModal: { mode: "edit", id: p.id, y: p.y, m: p.m, d: p.d } });
        }}
      >
        {batchMode && (
          <span aria-hidden style={{ flex: "0 0 auto", width: 13, height: 13, borderRadius: 4, border: `1.5px solid ${marcado ? "var(--cyan)" : "var(--label-3)"}`, background: marcado ? "var(--cyan)" : "transparent", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, lineHeight: 1 }}>{marcado ? "✓" : ""}</span>
        )}
        {ico ? (
          <span className="pc-ic" style={{ color: c }}><Ic name={ico} /></span>
        ) : (
          <span className="pc-dot" style={{ background: c }} />
        )}
        {fBadge && <span className={`pc-funil pc-funil-${fBadge}`} title={`Funil: ${p.funil}`}>{fBadge}</span>}
        {p.pilar && <span className="pc-pilar">{p.pilar}</span>}
        <span className="pc-t">{p.titulo || "(sem título)"}</span>
        {(() => {
          const STG: Record<string, { g: string; c: string }> = {
            publicado: { g: "✓", c: "#2FB457" },
            agendado: { g: "◷", c: "#00BBC5" },
            rascunho: { g: "○", c: "#8E8E93" },
            falhou: { g: "!", c: "#FF9F0A" },
            cancelado: { g: "✕", c: "#FF001E" },
          };
          const sg = STG[p.status] || STG.rascunho;
          return <span className="pc-status" style={{ color: sg.c }} title={`${st.label}${p.hora ? " · " + p.hora : ""}`}>{sg.g}</span>;
        })()}
      </button>
    );
  };

  // ── canais conectados (Zernio) — redes social/conversas conectadas ──
  const connRedes = redesConectadas(zernioAccounts);
  const nConn = connRedes.length;
  const [contasOpen, setContasOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [bibOpen, setBibOpen] = useState(false);
  // ── seleção em LOTE dentro da própria grade (marca chips por dia) ──
  const [batchMode, setBatchMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const hojeIso = (() => { const x = new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
  const [batchData, setBatchData] = useState(hojeIso);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  // DESFAZER a última ação de lote (1 nível): restaura o estado anterior, remove as cópias criadas,
  // ou tira da lixeira. "Publicar" real não entra (não dá pra despublicar).
  type BatchUndo =
    | { kind: "restore"; label: string; snaps: PostItem[] }
    | { kind: "removeCreated"; label: string; ids: string[] }
    | { kind: "untrash"; label: string; ids: string[] };
  const [undo, setUndo] = useState<BatchUndo | null>(null);
  const selPosts = posts.filter((p) => sel.has(p.id));
  const nSel = selPosts.length;
  const toggleSel = (id: string) => setSel((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selDia = (ids: string[]) => setSel((prev) => { const n = new Set(prev); const todos = ids.every((i) => n.has(i)); ids.forEach((i) => (todos ? n.delete(i) : n.add(i))); return n; });
  const sairLote = () => { setBatchMode(false); setSel(new Set()); setBatchMsg(null); setUndo(null); };
  const newPostId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
  const parseIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return { y, m: m - 1, d }; };
  const ddmm = (m: number, d: number) => `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}`;
  const persistPosts = () => savePosts(useStore.getState());
  const snapshot = (list: PostItem[]): PostItem[] => list.map((p) => JSON.parse(JSON.stringify(p)) as PostItem);
  const bMarcar = async (status: string) => {
    if (!nSel || batchBusy) return; setBatchBusy(true);
    setUndo({ kind: "restore", label: `status de ${nSel}`, snaps: snapshot(selPosts) });
    selPosts.forEach((p) => updatePost(p.id, { status } as Partial<PostItem>));
    await persistPosts(); setBatchBusy(false);
    setBatchMsg(`${nSel} marcado(s) como "${(POST_STATUS[status] || { label: status }).label}".`);
  };
  const bMover = async () => {
    if (!nSel || batchBusy) return; const { y, m, d } = parseIso(batchData); setBatchBusy(true);
    setUndo({ kind: "restore", label: `data de ${nSel}`, snaps: snapshot(selPosts) });
    selPosts.forEach((p) => updatePost(p.id, { y, m, d }));
    await persistPosts(); setBatchBusy(false); setBatchMsg(`${nSel} movido(s) para ${ddmm(m, d)}.`); setSel(new Set());
  };
  const bDuplicar = async (comData: boolean) => {
    if (!nSel || batchBusy) return; const dest = comData ? parseIso(batchData) : null; setBatchBusy(true);
    const novos: string[] = [];
    selPosts.forEach((p) => {
      const base = { ...p } as PostItem & { zernioPostId?: unknown };
      delete base.zernioPostId;
      const id = newPostId(); novos.push(id);
      addPost({ ...base, id, status: "rascunho", ...(dest ? { y: dest.y, m: dest.m, d: dest.d } : {}) } as PostItem);
    });
    setUndo({ kind: "removeCreated", label: `${novos.length} cópia(s)`, ids: novos });
    await persistPosts(); setBatchBusy(false);
    setBatchMsg(`${nSel} duplicado(s)${dest ? ` para ${ddmm(dest.m, dest.d)}` : ""} como rascunho.`); setSel(new Set());
  };
  // Replicar os selecionados PARA OUTRO CANAL (multicanal): cria cópias com o canal alvo + a conta
  // (rede) correspondente, mesma data, como rascunho. Ex.: conteúdo do Instagram replicado no TikTok.
  const bReplicarCanal = async (canalNome: string) => {
    if (!nSel || batchBusy || !canalNome) return; setBatchBusy(true);
    const rede = REDES.find((r) => r.label === canalNome);
    const novos: string[] = [];
    selPosts.forEach((p) => {
      const base = { ...p } as PostItem & { zernioPostId?: unknown };
      delete base.zernioPostId;
      const id = newPostId(); novos.push(id);
      addPost({ ...base, id, status: "rascunho", canal: canalNome, contas: rede ? [rede.id] : [], perfil: "", overrides: {} } as PostItem);
    });
    setUndo({ kind: "removeCreated", label: `${novos.length} réplica(s)`, ids: novos });
    await persistPosts(); setBatchBusy(false);
    setBatchMsg(`${nSel} replicado(s) para ${canalNome} como rascunho.`); setSel(new Set());
  };
  const bLixeira = async () => {
    if (!nSel || batchBusy) return; const ids = selPosts.map((p) => p.id); setBatchBusy(true);
    ids.forEach((id) => deletePost(id));
    await Promise.all(ids.map((id) => deletePostApi(id).catch(() => false)));
    setUndo({ kind: "untrash", label: `${ids.length} da lixeira`, ids });
    setBatchBusy(false); setBatchMsg(`${ids.length} enviado(s) pra lixeira (restaurável 7 dias).`); setSel(new Set());
  };
  const desfazer = async () => {
    if (!undo || batchBusy) return; setBatchBusy(true);
    if (undo.kind === "restore") {
      undo.snaps.forEach((snap) => updatePost(snap.id, snap));
      await persistPosts();
    } else if (undo.kind === "removeCreated") {
      undo.ids.forEach((id) => deletePost(id));
      await Promise.all(undo.ids.map((id) => deletePostApi(id).catch(() => false)));
    } else if (undo.kind === "untrash") {
      await Promise.all(undo.ids.map((id) => fetch("/api/posts/trash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action: "restore" }) }).catch(() => null)));
      await fetch("/api/posts").then((r) => r.json()).then((d) => { if (Array.isArray(d?.posts)) set({ posts: d.posts }); }).catch(() => {});
    }
    setBatchBusy(false); setBatchMsg("Ação desfeita."); setUndo(null);
  };
  const bPublicar = async () => {
    if (!nSel || batchBusy) return; setBatchBusy(true); setBatchMsg("Enviando publicações…"); setUndo(null);
    await persistPosts(); let ok = 0, pend = 0;
    for (const p of selPosts) {
      try {
        const r = await fetch("/api/posts/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ postId: p.id, publishNow: true }) });
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) { ok++; updatePost(p.id, { status: (j.status || "publicado") } as Partial<PostItem>); } else pend++;
      } catch { pend++; }
    }
    setBatchBusy(false); setBatchMsg(`Publicação enviada: ${ok} confirmada(s)${pend ? ` · ${pend} com pendência` : ""}.`); setSel(new Set());
  };
  const [dragOverKey, setDragOverKey] = useState<string | null>(null); // célula sob o post arrastado

  // ── modo apresentação (cronograma de produção por período) ──
  const [apOpen, setApOpen] = useState(false);
  const [apPeriodo, setApPeriodo] = useState<ApPeriodo>("mes");
  // range custom em DATAS ISO (yyyy-mm-dd) — pode CRUZAR meses (ex.: 20/ago a 05/set)
  const isoDia = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const [apCustom, setApCustom] = useState<[string, string]>([isoDia(year, month, 1), isoDia(year, month, Math.min(15, daysInMonth(year, month)))]);
  const [apOff, setApOff] = useState(0);
  const [apHidden, setApHidden] = useState<Set<string>>(new Set()); // canais desligados nos chips
  const [apModo, setApModo] = useState<"lista" | "grade" | "dia">("lista"); // como exibir os dias da janela
  const [apDia, setApDia] = useState(0); // índice do dia no modo "dia a dia"

  // janelas da apresentação. Custom = 1 janela única (as datas vêm de apCustom, podem cruzar meses).
  const apWins = (): [number, number][] => apPeriodo === "custom" ? [[1, 1]] : apWindows(apPeriodo, year, month);
  // lista de datas {y,m,d,dow} da janela atual (custom cruza meses via apCustom ISO)
  const apDatas = (win: [number, number]): { y: number; m: number; d: number; dow: number }[] => {
    const out: { y: number; m: number; d: number; dow: number }[] = [];
    if (apPeriodo === "custom") {
      const a = new Date(apCustom[0] + "T00:00:00"), b = new Date(apCustom[1] + "T00:00:00");
      const start = a <= b ? a : b, end = a <= b ? b : a;
      for (const dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) out.push({ y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate(), dow: dt.getDay() });
    } else {
      for (let d = win[0]; d <= win[1]; d++) out.push({ y: year, m: month, d, dow: new Date(year, month, d).getDay() });
    }
    return out;
  };

  const abrirApresentacao = () => {
    // abre na janela que contém "hoje" (se o mês exibido for o atual)
    const wins = apWins();
    const hoje = new Date();
    let off = 0;
    if (hoje.getFullYear() === year && hoje.getMonth() === month) {
      const dd = hoje.getDate();
      off = Math.max(0, wins.findIndex(([a, b]) => dd >= a && dd <= b));
    }
    setApOff(off);
    setApOpen(true);
  };

  // Escape fecha a apresentação
  useEffect(() => {
    if (!apOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setApOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [apOpen]);

  // ── toolbar: contadores por status do mês ──
  const mo = posts.filter((p) => p.y === year && p.m === month);
  const cnt = (st: string) => mo.filter((p) => p.status === st).length;
  const seg: [string, string][] = [
    ["todos", "Todos"],
    ["rascunho", "Rascunho · " + cnt("rascunho")],
    ["agendado", "Agendado · " + cnt("agendado")],
    ["publicado", "Publicado · " + cnt("publicado")],
  ];

  // ── grade do mês ──
  const first = new Date(year, month, 1).getDay();
  const dim = daysInMonth(year, month);
  const H = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // ── fila de agendamentos ──
  const agTot = posts.filter((p) => p.status === "agendado");
  const agendados = agTot
    .slice()
    .sort((a, b) => a.y - b.y || a.m - b.m || a.d - b.d || (a.hora || "").localeCompare(b.hora || ""))
    .slice(0, 10);

  // ── feriados ──
  const uf = s.ufFeriado || "RN";
  const UFS = ["RN", "Nacional", "SP", "RJ", "CE", "PE", "BA"];
  const fl = feriadosLista(year, uf);

  const mnav = (delta: number) => {
    let mm = month + delta;
    let yy = year;
    if (mm < 0) {
      mm = 11;
      yy--;
    }
    if (mm > 11) {
      mm = 0;
      yy++;
    }
    set({ calMonth: mm, calYear: yy });
  };

  return (
    <>
      <PageHead
        eyebrow="Operação · Conteúdo"
        title="Calendário de conteúdo"
        desc="Planeje, agende e publique nos canais conectados (Instagram, TikTok, LinkedIn, YouTube…). Adicione canais manuais (WhatsApp, blog…) para registrar conteúdo — sem publicação automática. Clique num dia para criar; num post para editar."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-link" onClick={() => setTrashOpen(true)} title="Posts excluídos (restauráveis por 7 dias)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
              </svg>
              Lixeira
            </button>
            <button className="btn-link" onClick={() => setBibOpen(true)} title="Biblioteca de conteúdo — histórico do que já foi produzido/publicado">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="13" y="4" width="7" height="16" rx="1.5" /><path d="M6.5 8h0M16.5 8h0" />
              </svg>
              Biblioteca
            </button>
            <button className="btn-link" onClick={() => (batchMode ? sairLote() : setBatchMode(true))} title="Marcar vários posts direto na grade e alterar status, publicar, duplicar, mover de data ou enviar pra lixeira em lote"
              style={batchMode ? { background: "var(--cyan)", color: "#fff", borderColor: "var(--cyan)" } : undefined}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              {batchMode ? "Sair da seleção" : "Selecionar em lote"}
            </button>
            <button className="btn-link" id="apresentarBtn" onClick={abrirApresentacao}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="4" width="18" height="12" rx="2" />
                <path d="M8 20h8M12 16v4" />
              </svg>
              Apresentar
            </button>
            <button
              className="btn-link ig"
              id="newPostBtn"
              onClick={() => set({ postModal: { mode: "new", y: year, m: month, d: 1 } })}
            >
              <Ic name="upload" /> Novo post
            </button>
          </div>
        }
      />

      {/* Canais conectados — minimizada por padrão (só ícones); expande no clique */}
      <div className={`card pad-lg${contasOpen ? " open" : ""}`} style={{ marginBottom: 14 }}>
        <div className="card-head" style={{ marginBottom: contasOpen ? 14 : 0, cursor: "pointer" }} onClick={() => setContasOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div className="t">Canais conectados</div>
            {!contasOpen &&
              (connRedes.length ? (
                <div className="cc-conx-mini">
                  {connRedes.map((r) => (
                    <span key={r.id} className="cc-conx-ico" style={{ background: r.cor }} title={r.label}>
                      {r.grupo === "social" ? <Ic name={r.id === "instagram" ? "ig" : r.id} /> : (r.label || "?")[0]}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="cc-conx-none">nenhuma conectada</span>
              ))}
          </div>
          <span className="badge">{nConn}</span>
          <svg className="acc-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ transform: contasOpen ? "rotate(180deg)" : "none", transition: ".18s", color: "var(--label-3)" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
        {contasOpen && (
          <>
            <ConexoesGrid grupos={["social", "conversas"]} />
            <ManualChannels />
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="cc-toolbar">
        <div className="cc-nav">
          <button data-mnav="-1" aria-label="Mês anterior" onClick={() => mnav(-1)}>
            ‹
          </button>
          <b>
            {MONTHS_FULL[month]} {year}
          </b>
          <button data-mnav="1" aria-label="Próximo mês" onClick={() => mnav(1)}>
            ›
          </button>
        </div>
        <div className="cc-seg">
          {seg.map(([v, l]) => (
            <button key={v} data-cv={v} className={calCV === v ? "on" : ""} onClick={() => set({ calCV: v })}>
              {l}
            </button>
          ))}
        </div>
        <select
          className="tb-select"
          id="ccCanal"
          style={{ flex: "0 0 auto", width: "auto", maxWidth: 190 }}
          value={calCanal}
          onChange={(e) => set({ calCanal: e.target.value })}
        >
          <option value="todos">Todos os canais</option>
          {canais.map((c) => (
            <option key={c.nome}>{c.nome}</option>
          ))}
        </select>
        {mostrarPerfil && (
          <select
            className="tb-select"
            id="ccPerfil"
            style={{ flex: "0 0 auto", width: "auto", maxWidth: 190 }}
            value={calPerfil}
            onChange={(e) => set({ calPerfil: e.target.value })}
          >
            <option value="todos">Todos os perfis</option>
            {perfis.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        )}
      </div>

      {/* Grade do mês */}
      <div className="card pad-lg">
        <div className="cc-grid">
          {H.map((x) => (
            <div className="cc-h" key={x}>
              {x}
            </div>
          ))}
          {Array.from({ length: first }).map((_, i) => (
            <div className="cc-cell cc-empty" key={`e${i}`} />
          ))}
          {Array.from({ length: dim }).map((_, i) => {
            const d = i + 1;
            const key = calKey(year, month, d);
            const fer = FERIADOS[key];
            const ev = EVENTOS[key];
            const dow = new Date(year, month, d).getDay();
            const dp = posts
              .filter((p) => p.y === year && p.m === month && p.d === d && postMatch(p))
              .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
            return (
              <div
                className={`cc-cell ${dow === 0 || dow === 6 ? "cc-we" : ""}${dragOverKey === key ? " cc-drop" : ""}`}
                data-newpost={`${year}-${month}-${d}`}
                key={d}
                onClick={() => { if (batchMode) return; set({ postModal: { mode: "new", y: year, m: month, d } }); }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverKey !== key) setDragOverKey(key); }}
                onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => { e.preventDefault(); setDragOverKey(null); const id = e.dataTransfer.getData("text/plain"); if (id) updatePost(id, { y: year, m: month, d }); }}
              >
                <div className="cc-top">
                  <span className="cc-dn">{d}</span>
                  {ev ? (
                    <span className="cc-ev" title={ev}>
                      {ev}
                    </span>
                  ) : fer ? (
                    <span className="cc-fer" title={fer}>
                      feriado
                    </span>
                  ) : null}
                  <span className="cc-add">+</span>
                </div>
                <div className="cc-posts">{dp.map(postChip)}</div>
                {dp.length > 0 && (
                  <div className="cc-daypop" onClick={(e) => e.stopPropagation()}>
                    <div className="cc-daypop-h" style={batchMode ? { cursor: "pointer", color: "var(--cyan)" } : undefined}
                      onClick={batchMode ? (e) => { e.stopPropagation(); selDia(dp.map((p) => p.id)); } : undefined}
                      title={batchMode ? "Marcar/desmarcar todos deste dia" : undefined}>
                      {String(d).padStart(2, "0")} · {WD_FULL[dow]} · {dp.length} {dp.length === 1 ? "post" : "posts"}{batchMode ? " · marcar dia" : ""}
                    </div>
                    {dp.map((p) => {
                      const st = POST_STATUS[p.status] || POST_STATUS.rascunho;
                      const marca = corMarca(p.canal, canalCor(p.canal));
                      const ic = iconeCanal(p.canal);
                      const on = batchMode && sel.has(p.id);
                      return (
                        <button
                          key={p.id}
                          className="cc-daypop-row"
                          style={on ? { boxShadow: "inset 0 0 0 2px var(--cyan)", borderRadius: 6 } : undefined}
                          onClick={(e) => { e.stopPropagation(); if (batchMode) { toggleSel(p.id); return; } set({ postModal: { mode: "edit", id: p.id, y: p.y, m: p.m, d: p.d } }); }}
                        >
                          {batchMode && <span aria-hidden style={{ flex: "0 0 auto", width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${on ? "var(--cyan)" : "var(--label-3)"}`, background: on ? "var(--cyan)" : "transparent", color: "#fff", fontSize: 9, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{on ? "✓" : ""}</span>}
                          <span className="cc-dp-st" style={{ background: st.cor }} title={st.label} />
                          {ic ? <span className="pc-ic" style={{ color: marca }}><Ic name={ic} /></span> : <span className="pc-dot" style={{ background: marca }} />}
                          {p.pilar && <span className="pc-pilar">{p.pilar}</span>}
                          <span className="cc-dp-t">{p.titulo || "(sem título)"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="cc-legend">
          {canais.map((c) => (
            <span className="cc-lg" key={c.nome}>
              <span className="pc-dot" style={{ background: c.cor }} />
              {c.nome}
            </span>
          ))}
        </div>
      </div>

      {/* Fila de agendamentos */}
      <div className="card pad-lg fila-card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="t">Fila de agendamentos</div>
            <div className="sub">próximas publicações automáticas nos canais conectados</div>
          </div>
          <span className="badge">{agTot.length}</span>
        </div>
        {agendados.length ? (
          <ul className="fila">
            {agendados.map((p) => {
              const dd = String(p.d).padStart(2, "0") + "/" + String(p.m + 1).padStart(2, "0");
              return (
                <li className="fila-row" key={p.id}>
                  <span className="fila-st" title={(POST_STATUS[p.status] || POST_STATUS.rascunho).label} style={{ background: (POST_STATUS[p.status] || POST_STATUS.rascunho).cor }} />
                  <span className="fila-when">
                    {dd} · {p.hora || "--:--"}
                  </span>
                  <span className="fila-t">{p.titulo}</span>
                  <span className="fila-accs">
                    {(p.contas || []).length ? (
                      (p.contas || []).map((id) => {
                        const r = REDES.find((x) => x.id === id);
                        return r ? (
                          <span className="conta-dot" style={{ background: corMarca(r.label, r.cor) }} title={r.label} key={id} />
                        ) : null;
                      })
                    ) : (
                      <span className="fila-none" title="Sem canal conectado — não sai automático">sem publicação automática</span>
                    )}
                  </span>
                  <button className="fila-pub" data-pubnow={p.id} onClick={() => updatePost(p.id, { status: "publicado" })}>
                    Marcar publicado
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="pm-hint" style={{ marginTop: 8 }}>
            Nenhum post agendado. Defina o status &quot;Agendado&quot; num post e escolha os canais.
          </div>
        )}
        <div className="tfoot-note" style={{ marginTop: 12 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9A9AA0"
            strokeWidth={2}
            style={{ flex: "0 0 14px", marginTop: 1 }}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>{" "}
          A publicação automática roda pela <b>plataforma</b> (API unificada, login seguro OAuth — sem app review de cada
          rede). Aqui &quot;Publicar agora&quot; simula o disparo mudando o status.
        </div>
      </div>

      {/* Feriados */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="t">Feriados {year}</div>
            <div className="sub">contexto para o planejamento</div>
          </div>
          <select
            className="tb-select"
            id="ufFeriadoSel"
            aria-label="Estado"
            value={uf}
            onChange={(e) => set({ ufFeriado: e.target.value })}
          >
            {UFS.map((u) => (
              <option value={u} key={u}>
                {u === "Nacional" ? "Só nacionais" : u}
              </option>
            ))}
          </select>
        </div>
        <ul className="struct-list" style={{ columns: 2, columnGap: 28 }}>
          {fl.map((ferItem, i) => (
            <li key={i}>
              <span className="d"></span>
              {ferItem[1]}
              <span className="meta">{ferItem[0]}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Modo apresentação — cronograma de produção por período */}
      {apOpen &&
        (() => {
          const wins = apWins();
          const off = Math.min(apOff, wins.length - 1);
          const win = wins[off] || [1, daysInMonth(year, month)];
          const canaisVisiveis = (nome: string) => !apHidden.has(nome);
          const datasJanela = apDatas(win);
          const postsDoDia = (x: { y: number; m: number; d: number }) => posts
            .filter((p) => p.y === x.y && p.m === x.m && p.d === x.d && canaisVisiveis(p.canal))
            .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
          // TODOS os dias da janela (inclusive vazios) — pra semana lado a lado e dia a dia
          const diasGrade = datasJanela.map((x) => ({ ...x, posts: postsDoDia(x) }));
          // dias COM posts (visão lista)
          const dias = diasGrade.filter((x) => x.posts.length);
          const totalPosts = dias.reduce((n, x) => n + x.posts.length, 0);
          // canais COM ativação nesta janela (independe do oculto) → topo preenchido; resto cinza
          const canaisAtivos = new Set<string>();
          for (const x of datasJanela)
            for (const p of posts) if (p.y === x.y && p.m === x.m && p.d === x.d) canaisAtivos.add(p.canal);
          const diaIdx = Math.min(apDia, Math.max(0, diasGrade.length - 1));
          const diaCur = diasGrade[diaIdx];
          const renderCard = (p: PostItem) => {
            const st = POST_STATUS[p.status] || POST_STATUS.rascunho;
            const marca = corMarca(p.canal, canalCor(p.canal));
            const ico = iconeCanal(p.canal);
            return (
              <article className="ap-card" key={p.id} style={{ borderLeftColor: marca }}>
                <div className="ap-card-top">
                  <span className="ap-card-time">{p.hora || "--:--"}</span>
                  <span className="ap-card-canal" style={{ color: marca }}>
                    {ico ? (
                      <span className="ap-canal-ic" style={{ color: marca }}><Ic name={ico} /></span>
                    ) : (
                      <span className="ap-chip-dot" style={{ background: marca }} />
                    )}
                    {p.canal}
                  </span>
                  {p.formato && <span className="ap-card-fmt">{p.formato}</span>}
                  {p.pilar && <span className="ap-card-tag ap-tag-pilar">{p.pilar}</span>}
                  {p.funil && <span className="ap-card-tag ap-tag-funil">{p.funil}</span>}
                  <span className="ap-card-st" style={{ color: st.cor, background: st.cor + "1f" }}>
                    {p.status === "publicado" ? "publicado ✓" : st.label}
                  </span>
                </div>
                <div className="ap-card-title">{p.titulo}</div>
                {p.legenda && <div className="ap-card-leg">{p.legenda}</div>}
              </article>
            );
          };
          return (
            <div className="ap-back" role="dialog" aria-modal="true">
              <div className="ap-shell">
                <header className="ap-head">
                  <div className="ap-head-l">
                    <div className="ap-eyebrow">Cronograma de produção · {MONTHS_FULL[month]} {year}</div>
                    <h2 className="ap-title">{apPeriodo === "custom"
                      ? `${apCustom[0].slice(8, 10)}/${apCustom[0].slice(5, 7)} a ${apCustom[1].slice(8, 10)}/${apCustom[1].slice(5, 7)}`
                      : apWindowLabel(apPeriodo, win, month)}</h2>
                    <div className="ap-sub">
                      {totalPosts} {totalPosts === 1 ? "publicação planejada" : "publicações planejadas"}
                    </div>
                  </div>
                  <button className="ap-close" aria-label="Fechar apresentação" onClick={() => setApOpen(false)}>
                    ✕
                  </button>
                </header>

                <div className="ap-controls">
                  <div className="ap-seg">
                    {([["mes", "Mês"], ["quinzena", "Quinzena"], ["semana", "Semana"], ["custom", "Período"]] as [ApPeriodo, string][]).map(
                      ([v, l]) => (
                        <button
                          key={v}
                          className={apPeriodo === v ? "on" : ""}
                          onClick={() => {
                            setApPeriodo(v);
                            setApOff(0);
                          }}
                        >
                          {l}
                        </button>
                      )
                    )}
                  </div>
                  {apPeriodo === "custom" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--label-2)", flexWrap: "wrap" }}>
                      <span>de</span>
                      <input type="date" className="field-edit" style={{ width: 150, padding: "5px 8px" }} value={apCustom[0]} onChange={(e) => { setApCustom(([, b]) => [e.target.value, b]); setApOff(0); }} />
                      <span>até</span>
                      <input type="date" className="field-edit" style={{ width: 150, padding: "5px 8px" }} value={apCustom[1]} onChange={(e) => { setApCustom(([a]) => [a, e.target.value]); setApOff(0); }} />
                    </div>
                  )}
                  <div className="ap-seg">
                    {([["lista", "Lista"], ["grade", "Semana"], ["dia", "Dia a dia"]] as ["lista" | "grade" | "dia", string][]).map(([v, l]) => (
                      <button key={v} className={apModo === v ? "on" : ""} onClick={() => { setApModo(v); if (v === "dia") setApDia(0); }}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {wins.length > 1 && (
                    <div className="ap-nav">
                      <button aria-label="Anterior" disabled={off <= 0} onClick={() => setApOff((o) => Math.max(0, o - 1))}>
                        ‹
                      </button>
                      <span>
                        {off + 1} / {wins.length}
                      </span>
                      <button
                        aria-label="Próximo"
                        disabled={off >= wins.length - 1}
                        onClick={() => setApOff((o) => Math.min(wins.length - 1, o + 1))}
                      >
                        ›
                      </button>
                    </div>
                  )}
                  <div className="ap-chips">
                    {canais.map((c) => {
                      const on = !apHidden.has(c.nome);
                      const ativo = canaisAtivos.has(c.nome); // tem publicação nesta janela?
                      const cor = ativo ? corMarca(c.nome, c.cor) : "var(--label-3)";
                      return (
                        <button
                          key={c.nome}
                          className={`ap-chip${on ? " on" : ""}${ativo ? "" : " ap-chip-off"}`}
                          title={ativo ? "" : "Sem publicação nesta semana"}
                          onClick={() =>
                            setApHidden((prev) => {
                              const nx = new Set(prev);
                              if (nx.has(c.nome)) nx.delete(c.nome);
                              else nx.add(c.nome);
                              return nx;
                            })
                          }
                        >
                          {iconeCanal(c.nome) ? (
                            <span className="ap-canal-ic" style={{ color: cor }}><Ic name={iconeCanal(c.nome)} /></span>
                          ) : (
                            <span className="ap-chip-dot" style={{ background: cor }} />
                          )}
                          {c.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`ap-body${apModo === "grade" ? " ap-body-grade" : ""}`}>
                  {apModo === "grade" ? (
                    <div className="ap-grade">
                      {diasGrade.map(({ y, m, d, dow, posts: dp }) => (
                        <div className="ap-col" key={`${y}-${m}-${d}`}>
                          <div className="ap-col-h">
                            <b>{String(d).padStart(2, "0")}{apPeriodo === "custom" ? "/" + String(m + 1).padStart(2, "0") : ""}</b>
                            <span>{H[dow]}</span>
                            <em>{dp.length}</em>
                          </div>
                          <div className="ap-col-body">
                            {dp.length ? dp.map(renderCard) : <div className="ap-col-empty">—</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : apModo === "dia" ? (
                    diaCur ? (
                      <div className="ap-diaview">
                        <div className="ap-dia-nav">
                          <button aria-label="Dia anterior" disabled={diaIdx <= 0} onClick={() => setApDia((i) => Math.max(0, i - 1))}>‹</button>
                          <select className="ap-dia-sel" value={diaIdx} onChange={(e) => setApDia(Number(e.target.value))} aria-label="Escolher dia">
                            {diasGrade.map((x, i) => (
                              <option key={`${x.y}-${x.m}-${x.d}`} value={i}>
                                {String(x.d).padStart(2, "0")}{apPeriodo === "custom" ? "/" + String(x.m + 1).padStart(2, "0") : ""} · {WD_FULL[x.dow]} · {x.posts.length} {x.posts.length === 1 ? "post" : "posts"}
                              </option>
                            ))}
                          </select>
                          <button aria-label="Próximo dia" disabled={diaIdx >= diasGrade.length - 1} onClick={() => setApDia((i) => Math.min(diasGrade.length - 1, i + 1))}>›</button>
                        </div>
                        <div className="ap-dia-cards">
                          {diaCur.posts.length ? diaCur.posts.map(renderCard) : <div className="ap-empty">Nenhuma publicação neste dia.</div>}
                        </div>
                      </div>
                    ) : (
                      <div className="ap-empty">Sem dias nesta janela.</div>
                    )
                  ) : dias.length ? (
                    dias.map(({ y, m, d, dow, posts: dp }) => (
                      <section className="ap-day" key={`${y}-${m}-${d}`}>
                        <div className="ap-day-h">
                          <span className="ap-day-num">{String(d).padStart(2, "0")}</span>
                          <div>
                            <div className="ap-day-wd">{WD_FULL[dow]}</div>
                            <div className="ap-day-meta">{d} de {MONTHS_FULL[m]}</div>
                          </div>
                          <span className="ap-day-count">{dp.length}</span>
                        </div>
                        <div className="ap-cards">{dp.map(renderCard)}</div>
                      </section>
                    ))
                  ) : (
                    <div className="ap-empty">
                      Nenhuma publicação planejada neste período{apHidden.size ? " para os canais selecionados" : ""}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Modal (remonta a cada abertura via key) */}
      {s.postModal && (
        <PostModal
          key={`${s.postModal.mode}-${s.postModal.id ?? ""}-${s.postModal.y}-${s.postModal.m}-${s.postModal.d}`}
        />
      )}
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      {bibOpen && <BibliotecaPanel onClose={() => setBibOpen(false)} />}
      {batchMode && (
        <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 18, zIndex: 60, background: "var(--white, #fff)", border: "1px solid var(--hairline)", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,.16)", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8, maxWidth: "min(940px, 94vw)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <b style={{ fontSize: 13 }}>{nSel} selecionado(s)</b>
            <span className="pm-hint" style={{ margin: 0 }}>{batchMsg || (nSel ? "Escolha uma ação" : "Clique nos posts na grade pra marcar")}</span>
            {undo && (
              <button className="btn-link" onClick={desfazer} disabled={batchBusy} title={`Desfazer: ${undo.label}`} style={{ marginLeft: "auto", fontWeight: 700, color: "var(--cyan)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "-2px" }}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>
                Desfazer
              </button>
            )}
            <button className="btn-link" style={{ marginLeft: undo ? 0 : "auto" }} onClick={sairLote}>Sair da seleção</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", opacity: nSel && !batchBusy ? 1 : 0.5, pointerEvents: nSel && !batchBusy ? "auto" : "none" }}>
            <span style={{ fontSize: 12, fontWeight: 650, color: "var(--label-2)" }}>Marcar:</span>
            <select className="field-edit" style={{ padding: "5px 8px", fontSize: 12.5 }} defaultValue="" onChange={(e) => { if (e.target.value) { bMarcar(e.target.value); e.currentTarget.value = ""; } }}>
              <option value="" disabled>status…</option>
              <option value="rascunho">Rascunho</option>
              <option value="agendado">Agendado</option>
              <option value="publicado">Publicado</option>
              <option value="cancelado">Cancelado / impedido</option>
            </select>
            <button className="btn-link ig" onClick={bPublicar} title="Dispara a publicação real nos canais conectados">Publicar agora</button>
            <button className="btn-link" onClick={() => bDuplicar(false)} title="Cria cópia (rascunho) na mesma data">Duplicar</button>
            <button type="button" onClick={bLixeira} style={{ border: 0, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12.5, fontWeight: 650 }} title="Envia pra lixeira (restaurável 7 dias)">Lixeira</button>
            <span style={{ width: 1, height: 20, background: "var(--hairline)" }} />
            <span style={{ fontSize: 12, fontWeight: 650, color: "var(--label-2)" }}>Data:</span>
            <input type="date" className="field-edit" style={{ width: 148, padding: "5px 8px", fontSize: 12.5 }} value={batchData} onChange={(e) => setBatchData(e.target.value)} />
            <button className="btn-link" onClick={bMover} title="Move os selecionados pra essa data">Mover</button>
            <button className="btn-link" onClick={() => bDuplicar(true)} title="Duplica os selecionados nessa data (rascunho)">Duplicar na data</button>
            <span style={{ width: 1, height: 20, background: "var(--hairline)" }} />
            <span style={{ fontSize: 12, fontWeight: 650, color: "var(--label-2)" }}>Replicar p/ canal:</span>
            <select className="field-edit" style={{ padding: "5px 8px", fontSize: 12.5 }} defaultValue="" onChange={(e) => { if (e.target.value) { bReplicarCanal(e.target.value); e.currentTarget.value = ""; } }} title="Cria cópias dos selecionados em outro canal (multicanal), como rascunho">
              <option value="" disabled>canal…</option>
              {canais.map((c) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      )}
    </>
  );
}

// Lixeira — posts excluídos (soft-delete), restauráveis por 7 dias.
interface TrashItem { id: string; titulo: string; canal: string; y: number; m: number; d: number; hora: string; diasRestantes: number }
function TrashPanel({ onClose }: { onClose: () => void }) {
  const set = useStore((st) => st.set);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    fetch("/api/posts/trash").then((r) => r.json()).then((d) => setItems(Array.isArray(d?.items) ? d.items : [])).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);
  const refreshPosts = () => fetch("/api/posts").then((r) => r.json()).then((d) => { if (Array.isArray(d?.posts)) set({ posts: d.posts }); }).catch(() => {});
  const act = async (id: string, action: "restore" | "purge") => {
    await fetch("/api/posts/trash", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, action }) }).catch(() => {});
    load();
    if (action === "restore") refreshPosts();
  };
  return (
    <div className="pm-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm" role="dialog" aria-modal="true" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="pm-head"><b>Lixeira</b><button className="pm-x" aria-label="Fechar" onClick={onClose}>✕</button></div>
        <div className="pm-body">
          <div className="pm-hint" style={{ marginBottom: 10 }}>Posts excluídos ficam aqui por <b>7 dias</b> e depois são apagados de vez. Restaure enquanto der.</div>
          {loading ? (
            <div className="pm-hint">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="pm-hint">Lixeira vazia.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--hairline)", borderRadius: 10, padding: "8px 10px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.titulo || "(sem título)"}</div>
                    <div style={{ fontSize: 11.5, color: "var(--label-3)" }}>{it.canal} · {String(it.d).padStart(2, "0")}/{String(it.m + 1).padStart(2, "0")} · restam {it.diasRestantes}d</div>
                  </div>
                  <button className="btn-link ig" onClick={() => act(it.id, "restore")}>Restaurar</button>
                  <button type="button" onClick={() => act(it.id, "purge")} style={{ border: 0, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Apagar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Canais MANUAIS — gerenciados pelo usuário. Só registro de conteúdo (sem publicação
// síncrona). Aparecem no seletor de canal e no PostModal como opção de canal.
function ManualChannels() {
  const calManuais = useStore((s) => s.calManuais);
  const addCalManual = useStore((s) => s.addCalManual);
  const removeCalManual = useStore((s) => s.removeCalManual);
  const [val, setVal] = useState("");
  const add = () => { const v = val.trim(); if (v) addCalManual(v); setVal(""); };
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--hairline)" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Canais manuais</div>
      <div style={{ fontSize: 12, color: "var(--label-3)", marginBottom: 10 }}>
        Só registro de conteúdo — <b>sem publicação automática</b>. Use para WhatsApp, blog, newsletter e afins.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {calManuais.length === 0 && <span style={{ fontSize: 12.5, color: "var(--label-3)" }}>Nenhum canal manual ainda.</span>}
        {calManuais.map((c) => (
          <span key={c} className="chip-rm">
            {c}
            <button onClick={() => removeCalManual(c)} aria-label={`Remover ${c}`} type="button">✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, maxWidth: 360 }}>
        <input
          className="field-edit"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="+ novo canal manual (ex.: WhatsApp)"
          aria-label="Novo canal manual"
        />
        <button className="btn-link ig" onClick={add} type="button">Adicionar</button>
      </div>
    </div>
  );
}
