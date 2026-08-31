"use client";
// Biblioteca de conteúdo: arquivo/histórico do que já foi produzido (publicado, agendado, tudo),
// em grade estilo feed — pra rever, com preview de como ficou, e abrir o post pra detalhes.
import { useMemo, useState } from "react";
import { useStore, type PostItem } from "@/lib/store";
import { Ic } from "@/components/Ic";
import { ICONS } from "@/lib/nav";
import { REDES } from "@/lib/seed-data";

const ICON_BY_ID: Record<string, string> = { instagram: "ig", x: "x" };
function redeDoCanal(canal: string) {
  return REDES.find((r) => r.label === canal);
}
function iconeCanal(canal: string): string | null {
  const rede = redeDoCanal(canal);
  if (!rede) return null;
  const k = ICON_BY_ID[rede.id] || rede.id;
  return ICONS[k] ? k : null;
}
const STATUS_COR: Record<string, string> = {
  publicado: "#2FB457", agendado: "#00BBC5", rascunho: "#8E8E93", falhou: "#FF9F0A", cancelado: "#FF001E",
};

export function BibliotecaPanel({ onClose }: { onClose: () => void }) {
  const posts = useStore((s) => s.posts);
  const set = useStore((s) => s.set);
  const [status, setStatus] = useState<"publicado" | "agendado" | "todos">("publicado");
  const [canal, setCanal] = useState<string>("todos");

  const canais = useMemo(() => Array.from(new Set(posts.map((p) => p.canal).filter(Boolean))).sort(), [posts]);

  const itens = useMemo(() => {
    return posts
      .filter((p) => (status === "todos" ? true : p.status === status))
      .filter((p) => (canal === "todos" ? true : p.canal === canal))
      .sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.d - a.d) || (b.hora || "").localeCompare(a.hora || ""));
  }, [posts, status, canal]);

  const abrir = (p: PostItem) => set({ postModal: { mode: "edit", id: p.id, y: p.y, m: p.m, d: p.d } });

  return (
    <div className="ap-back" role="dialog" aria-modal="true">
      <div className="ap-shell">
        <header className="ap-head">
          <div className="ap-head-l">
            <div className="ap-eyebrow">Arquivo de produção</div>
            <h2 className="ap-title">Biblioteca de conteúdo</h2>
            <div className="ap-sub">{itens.length} {itens.length === 1 ? "conteúdo" : "conteúdos"}</div>
          </div>
          <button className="ap-close" aria-label="Fechar" onClick={onClose}>✕</button>
        </header>

        <div className="bib-filtros">
          <div className="ap-seg">
            {([["publicado", "Publicados"], ["agendado", "Agendados"], ["todos", "Todos"]] as [typeof status, string][]).map(([v, l]) => (
              <button key={v} className={status === v ? "on" : ""} onClick={() => setStatus(v)} type="button">{l}</button>
            ))}
          </div>
          <select className="field-edit" style={{ maxWidth: 220, fontSize: 12.5 }} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option value="todos">Todos os canais</option>
            {canais.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="bib-scroll">
          {itens.length === 0 ? (
            <div className="empty" style={{ margin: "40px auto" }}>
              <div className="e-ico">🗂️</div>
              <h3>Nada por aqui ainda</h3>
              <p>Os conteúdos aparecem aqui conforme você produz e publica no calendário.</p>
            </div>
          ) : (
            <div className="bib-grid">
              {itens.map((p) => {
                const rede = redeDoCanal(p.canal);
                const cor = rede?.cor || "#111";
                const ic = iconeCanal(p.canal);
                const m0 = p.media?.[0];
                const stc = STATUS_COR[p.status] || STATUS_COR.rascunho;
                return (
                  <button key={p.id} className="bib-tile" type="button" onClick={() => abrir(p)} title={`${p.titulo || "(sem título)"} · ${p.canal}`}>
                    <div className="bib-media">
                      {m0?.url && (m0.type === "image" || m0.type === "gif") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m0.url} alt="" />
                      ) : m0?.url && m0.type === "video" ? (
                        <>
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video src={m0.url} muted playsInline />
                          <span className="bib-play">▶</span>
                        </>
                      ) : (
                        <div className="bib-noimg" style={{ background: cor }}>
                          <span>{p.formato || p.canal}</span>
                        </div>
                      )}
                      {/* status */}
                      <span className="bib-status" style={{ background: stc }} title={p.status} />
                      {/* canal */}
                      <span className="bib-canal" style={{ background: cor }}>{ic ? <Ic name={ic} /> : (p.canal[0] || "?")}</span>
                    </div>
                    <div className="bib-info">
                      <div className="bib-title">{p.titulo || "(sem título)"}</div>
                      <div className="bib-meta">{String(p.d).padStart(2, "0")}/{String(p.m + 1).padStart(2, "0")} · {p.formato || "—"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
