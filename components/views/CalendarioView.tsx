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
  publicado: { label: "Publicado", cor: "#2FB457" },
  falhou: { label: "Falhou", cor: "#FF001E" },
};

const calKey = (y: number, m: number, d: number) => y + "-" + (m + 1) + "-" + d;

// ── Modo apresentação ──────────────────────────────────────────────
const WD_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type ApPeriodo = "mes" | "quinzena" | "semana";
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
    const c = canalCor(p.canal);
    const nc = (p.contas || []).length;
    const acc = nc ? ` → ${nc} ${nc === 1 ? "canal" : "canais"}` : "";
    return (
      <button
        key={p.id}
        className={`post-chip st-${p.status}`}
        data-post={p.id}
        title={`${p.canal} · ${p.perfil} · ${st.label}${acc}`}
        onClick={(e) => {
          e.stopPropagation();
          set({ postModal: { mode: "edit", id: p.id, y: p.y, m: p.m, d: p.d } });
        }}
      >
        <span className="pc-dot" style={{ background: c }} />
        <span className="pc-h">{p.hora || ""}</span>
        <span className="pc-t">{p.titulo}</span>
        {p.status === "publicado" && (
          <span className="pc-check" title={`Publicado ${p.hora || ""}`}>
            ✓
          </span>
        )}
      </button>
    );
  };

  // ── canais conectados (Zernio) — redes social/conversas conectadas ──
  const connRedes = redesConectadas(zernioAccounts);
  const nConn = connRedes.length;
  const [contasOpen, setContasOpen] = useState(false);

  // ── modo apresentação (cronograma de produção por período) ──
  const [apOpen, setApOpen] = useState(false);
  const [apPeriodo, setApPeriodo] = useState<ApPeriodo>("mes");
  const [apOff, setApOff] = useState(0);
  const [apHidden, setApHidden] = useState<Set<string>>(new Set()); // canais desligados nos chips

  const abrirApresentacao = () => {
    // abre na janela que contém "hoje" (se o mês exibido for o atual)
    const wins = apWindows(apPeriodo, year, month);
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
                className={`cc-cell ${dow === 0 || dow === 6 ? "cc-we" : ""}`}
                data-newpost={`${year}-${month}-${d}`}
                key={d}
                onClick={() => set({ postModal: { mode: "new", y: year, m: month, d } })}
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
                  <span className="fila-when">
                    {dd} · {p.hora || "--:--"}
                  </span>
                  <span className="fila-t">{p.titulo}</span>
                  <span className="fila-accs">
                    {(p.contas || []).length ? (
                      (p.contas || []).map((id) => {
                        const r = REDES.find((x) => x.id === id);
                        return r ? (
                          <span className="conta-dot" style={{ background: r.cor }} title={r.label} key={id} />
                        ) : null;
                      })
                    ) : (
                      <span className="fila-none">sem canal</span>
                    )}
                  </span>
                  {/* TODO(zernio): "Publicar agora" simula o disparo mudando o status. */}
                  <button className="fila-pub" data-pubnow={p.id} onClick={() => updatePost(p.id, { status: "publicado" })}>
                    Publicar agora
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
          const wins = apWindows(apPeriodo, year, month);
          const off = Math.min(apOff, wins.length - 1);
          const win = wins[off] || [1, daysInMonth(year, month)];
          const canaisVisiveis = (nome: string) => !apHidden.has(nome);
          // dias da janela com posts visíveis (só canais ligados)
          const dias: { d: number; dow: number; posts: PostItem[] }[] = [];
          for (let d = win[0]; d <= win[1]; d++) {
            const dp = posts
              .filter((p) => p.y === year && p.m === month && p.d === d && canaisVisiveis(p.canal))
              .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
            if (dp.length) dias.push({ d, dow: new Date(year, month, d).getDay(), posts: dp });
          }
          const totalPosts = dias.reduce((n, x) => n + x.posts.length, 0);
          return (
            <div className="ap-back" role="dialog" aria-modal="true">
              <div className="ap-shell">
                <header className="ap-head">
                  <div className="ap-head-l">
                    <div className="ap-eyebrow">Cronograma de produção · {MONTHS_FULL[month]} {year}</div>
                    <h2 className="ap-title">{apWindowLabel(apPeriodo, win, month)}</h2>
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
                    {([["mes", "Mês"], ["quinzena", "Quinzena"], ["semana", "Semana"]] as [ApPeriodo, string][]).map(
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
                      return (
                        <button
                          key={c.nome}
                          className={`ap-chip${on ? " on" : ""}`}
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
                            <span className="ap-canal-ic" style={{ color: corMarca(c.nome, c.cor) }}><Ic name={iconeCanal(c.nome)} /></span>
                          ) : (
                            <span className="ap-chip-dot" style={{ background: corMarca(c.nome, c.cor) }} />
                          )}
                          {c.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="ap-body">
                  {dias.length ? (
                    dias.map(({ d, dow, posts: dp }) => (
                      <section className="ap-day" key={d}>
                        <div className="ap-day-h">
                          <span className="ap-day-num">{String(d).padStart(2, "0")}</span>
                          <div>
                            <div className="ap-day-wd">{WD_FULL[dow]}</div>
                            <div className="ap-day-meta">
                              {d} de {MONTHS_FULL[month]}
                            </div>
                          </div>
                          <span className="ap-day-count">{dp.length}</span>
                        </div>
                        <div className="ap-cards">
                          {dp.map((p) => {
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
                                  <span className="ap-card-st" style={{ color: st.cor, background: st.cor + "1f" }}>
                                    {p.status === "publicado" ? "publicado ✓" : st.label}
                                  </span>
                                </div>
                                <div className="ap-card-title">{p.titulo}</div>
                                {p.legenda && <div className="ap-card-leg">{p.legenda}</div>}
                              </article>
                            );
                          })}
                        </div>
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
    </>
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
