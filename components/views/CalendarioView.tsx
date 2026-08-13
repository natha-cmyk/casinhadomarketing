"use client";
// Porta viewCalendario (blueprint 1445-1474) + helpers contaChip/filaRow/postMatch/postChip/
// contentMonthGrid (1417-1444) + feriadosMoveis/feriadosLista (662-663). Estética mLabs.
import { useEffect, useState } from "react";
import { useStore, type PostItem } from "@/lib/store";
import {
  CANAIS_POST,
  PERFIS_POST,
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

// plataforma Zernio → id da rede (Casinha): twitter → x
const PLAT_REV: Record<string, string> = { twitter: "x" };

const POST_STATUS: Record<string, { label: string; cor: string }> = {
  rascunho: { label: "Rascunho", cor: "#8E8E93" },
  agendado: { label: "Agendado", cor: "#00BBC5" },
  publicado: { label: "Publicado", cor: "#2FB457" },
  falhou: { label: "Falhou", cor: "#FF001E" },
};

const calKey = (y: number, m: number, d: number) => y + "-" + (m + 1) + "-" + d;

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
    const c = CANAL_POST_COLORS[p.canal] || "#8E8E93";
    const acc = (p.contas || []).length ? ` → ${(p.contas || []).length} conta(s)` : "";
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
      </button>
    );
  };

  // ── contas conectadas (Zernio) — redes social/conversas conectadas ──
  const connRedes = Array.from(new Set(zernioAccounts.map((a) => PLAT_REV[a.platform] || a.platform)))
    .map((id) => REDES.find((x) => x.id === id))
    .filter((r): r is (typeof REDES)[number] => !!r && r.grupo !== "ads");
  const nConn = connRedes.length;
  const [contasOpen, setContasOpen] = useState(false);

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
        desc="Planeje, agende e publique — Instagram, TikTok, LinkedIn e YouTube (contas conectadas) + WhatsApp, lista de transmissão e blog. Clique num dia para criar; num post para editar."
        right={
          <button
            className="btn-link ig"
            id="newPostBtn"
            onClick={() => set({ postModal: { mode: "new", y: year, m: month, d: 1 } })}
          >
            <Ic name="upload" /> Novo post
          </button>
        }
      />

      {/* Contas conectadas — minimizada por padrão (só ícones); expande no clique */}
      <div className={`card pad-lg${contasOpen ? " open" : ""}`} style={{ marginBottom: 14 }}>
        <div className="card-head" style={{ marginBottom: contasOpen ? 14 : 0, cursor: "pointer" }} onClick={() => setContasOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div className="t">Contas conectadas</div>
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
        {contasOpen && <ConexoesGrid grupos={["social", "conversas"]} />}
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
          {CANAIS_POST.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className="tb-select"
          id="ccPerfil"
          value={calPerfil}
          onChange={(e) => set({ calPerfil: e.target.value })}
        >
          <option value="todos">Todos os perfis</option>
          {PERFIS_POST.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
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
          {CANAIS_POST.map((c) => (
            <span className="cc-lg" key={c}>
              <span className="pc-dot" style={{ background: CANAL_POST_COLORS[c] }} />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Fila de agendamentos */}
      <div className="card pad-lg fila-card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div>
            <div className="t">Fila de agendamentos</div>
            <div className="sub">próximas publicações automáticas nas contas conectadas</div>
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
                      <span className="fila-none">sem conta</span>
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
            Nenhum post agendado. Defina o status &quot;Agendado&quot; num post e escolha as contas.
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

      {/* Modal (remonta a cada abertura via key) */}
      {s.postModal && (
        <PostModal
          key={`${s.postModal.mode}-${s.postModal.id ?? ""}-${s.postModal.y}-${s.postModal.m}-${s.postModal.d}`}
        />
      )}
    </>
  );
}
