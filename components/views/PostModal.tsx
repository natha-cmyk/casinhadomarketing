"use client";
// Porta renderPostModal (blueprint 1475-1504) + savePost (1505-1515).
// Modal de criação/edição de post do calendário de conteúdo.
import { useRef, useState } from "react";
import { useStore, newId, type PostItem, type PostMedia } from "@/lib/store";
import { savePosts } from "@/lib/api";
import {
  CANAL_POST_COLORS,
  PILARES_POST,
  FORMATOS_POST,
  FUNIL_POST,
  REDES,
} from "@/lib/seed-data";

// plataforma Zernio → id da rede (Casinha): twitter → x
const PLAT_REV: Record<string, string> = { twitter: "x" };
// Canais manuais de conteúdo (não são contas conectadas de rede, mas seguem como opções).
const MANUAIS_POST = ["WhatsApp (grupos)", "Lista de transmissão", "Blog"];

type ZAccount = {
  platform: string;
  displayName?: string;
  username?: string;
  enabled?: boolean;
  adsStatus?: string;
};

// Redes REALMENTE conectadas (social/conversas) derivadas das contas Zernio (twitter→x).
function redesConectadas(accounts: ZAccount[]): (typeof REDES)[number][] {
  const ids = Array.from(new Set(accounts.map((a) => PLAT_REV[a.platform] || a.platform)));
  return ids
    .map((id) => REDES.find((r) => r.id === id))
    .filter((r): r is (typeof REDES)[number] => !!r && r.grupo !== "ads");
}

// Canais conectados = redes conectadas + canais manuais de conteúdo. Cada um com sua cor.
function canaisConectados(accounts: ZAccount[]): { nome: string; cor: string }[] {
  const redes = redesConectadas(accounts).map((r) => ({ nome: r.label, cor: r.cor }));
  const manuais = MANUAIS_POST.map((nome) => ({ nome, cor: CANAL_POST_COLORS[nome] || "#8E8E93" }));
  return [...redes, ...manuais];
}

// Perfis conectados = um por conta conectada (displayName/username). Preparado p/ multi-conta.
function perfisConectados(accounts: ZAccount[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of accounts) {
    const id = PLAT_REV[a.platform] || a.platform;
    const rede = REDES.find((r) => r.id === id);
    if (rede && rede.grupo === "ads") continue;
    const nome = (a.displayName || a.username || rede?.label || a.platform || "").trim();
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

interface Fields {
  data: string;
  hora: string;
  titulo: string;
  canal: string;
  formato: string;
  perfil: string;
  colab: string;
  pilar: string;
  funil: string;
  arquivo: string;
  media: PostMedia[];
  legenda: string;
  cta: string;
  hashtags: string;
  status: string;
  contas: string[];
}

// MIME → tipo de MediaItem da Zernio
function mimeToType(mime: string): PostMedia["type"] {
  if (mime === "image/gif") return "gif";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "document";
}

export function PostModal() {
  const pm = useStore((st) => st.postModal);
  const posts = useStore((st) => st.posts);
  const zernioAccounts = useStore((st) => st.zernioAccounts);
  const calMonth = useStore((st) => st.calMonth);
  const calYear = useStore((st) => st.calYear);
  const set = useStore((st) => st.set);
  const addPost = useStore((st) => st.addPost);
  const updatePost = useStore((st) => st.updatePost);
  const deletePost = useStore((st) => st.deletePost);

  // Fonte única (auto-sincroniza quando novas contas conectam):
  const canais = canaisConectados(zernioAccounts);
  const perfis = perfisConectados(zernioAccounts);

  const existing = pm && pm.mode === "edit" ? posts.find((x) => x.id === pm.id) : undefined;

  // Estado do disparo real (agendar/publicar via Zernio).
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  // Upload de mídia (presign Zernio → PUT direto no storage)
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Estado seed: post existente (edição) ou defaults do blueprint (novo).
  const [f, setF] = useState<Fields>(() => {
    if (pm && pm.mode === "edit" && existing) {
      return {
        data:
          String(existing.d).padStart(2, "0") +
          "/" +
          String(existing.m + 1).padStart(2, "0") +
          "/" +
          existing.y,
        hora: existing.hora,
        titulo: existing.titulo,
        canal: existing.canal,
        formato: existing.formato,
        perfil: existing.perfil,
        colab: existing.colab,
        pilar: existing.pilar,
        funil: existing.funil,
        arquivo: existing.arquivo,
        media: existing.media ?? [],
        legenda: existing.legenda,
        cta: existing.cta,
        hashtags: existing.hashtags,
        status: existing.status,
        contas: [...(existing.contas || [])],
      };
    }
    const y = pm?.y ?? calYear;
    const m = pm?.m ?? calMonth;
    const d = pm?.d ?? 1;
    return {
      data: String(d).padStart(2, "0") + "/" + String(m + 1).padStart(2, "0") + "/" + y,
      hora: "09:00",
      titulo: "",
      canal: canais[0]?.nome ?? "Instagram",
      formato: "Reels",
      perfil: perfis[0] ?? "",
      colab: "",
      pilar: "Espaços",
      funil: "Topo",
      arquivo: "",
      media: [],
      legenda: "",
      cta: "",
      hashtags: "",
      status: "rascunho",
      contas: [],
    };
  });

  if (!pm) return null;
  if (pm.mode === "edit" && !existing) return null;

  const upd = (patch: Partial<Fields>) => setF((prev) => ({ ...prev, ...patch }));

  // Upload real: presign na nossa API → PUT do arquivo DIRETO no storage (não passa
  // pelo servidor → sem limite de 4.5MB) → guarda publicUrl como MediaItem.
  const onPickFile = async (file: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setMsg(null);
    try {
      const pres = await fetch("/api/posts/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const pj = await pres.json().catch(() => null);
      if (!pres.ok || !pj?.uploadUrl) throw new Error(pj?.error || "não foi possível preparar o upload");
      const put = await fetch(pj.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error(`upload falhou (${put.status})`);
      const item: PostMedia = { type: mimeToType(file.type), url: pj.publicUrl, filename: file.name, mimeType: file.type, size: file.size };
      setF((prev) => ({ ...prev, media: [...prev.media, item], arquivo: prev.arquivo || file.name }));
      setMsg({ kind: "ok", text: `“${file.name}” enviado ✓` });
    } catch (e) {
      setMsg({ kind: "err", text: `Falha no upload: ${String((e as Error)?.message || e).slice(0, 90)}` });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const removeMedia = (url: string) => setF((prev) => ({ ...prev, media: prev.media.filter((m) => m.url !== url) }));

  const close = () => set({ postModal: null });

  // Monta os campos do post a partir do formulário (com status opcional forçado).
  const buildBase = (forceStatus?: string) => {
    const dp = f.data.split("/").map((s) => parseInt(s, 10));
    const d = dp[0] || 1;
    const m = (dp[1] || calMonth + 1) - 1;
    const y = dp[2] || calYear;
    return {
      hora: f.hora,
      titulo: f.titulo || "(sem título)",
      canal: f.canal,
      formato: f.formato,
      perfil: f.perfil,
      colab: f.colab,
      pilar: f.pilar,
      funil: f.funil,
      arquivo: f.arquivo,
      media: f.media,
      legenda: f.legenda,
      cta: f.cta,
      hashtags: f.hashtags,
      status: forceStatus ?? f.status,
      contas: f.contas,
      y,
      m,
      d,
    };
  };

  // Persiste no store (cria ou atualiza) e devolve o id do post.
  const persist = (forceStatus?: string): string => {
    const base = buildBase(forceStatus);
    if (pm.mode === "edit" && pm.id) {
      updatePost(pm.id, base);
      return pm.id;
    }
    const id = newId("post");
    addPost({ id, ...base } as PostItem);
    return id;
  };

  const doSave = (forceStatus?: string) => {
    persist(forceStatus);
    close();
  };

  // Disparo REAL: agenda (publishNow=false) ou publica na hora (publishNow=true) via Zernio.
  const doPublish = async (publishNow: boolean) => {
    if (busy) return;
    if (!conn.length || f.contas.length === 0) {
      setMsg({ kind: "err", text: 'Escolha ao menos um canal conectado em "Publicar em" antes de agendar.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    // grava no store já como "agendado" (a rota devolve o status final e volta a atualizar)
    const id = persist(publishNow ? undefined : "agendado");
    try {
      await savePosts(useStore.getState()); // garante o post no banco p/ a rota ler
      const r = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId: id, publishNow }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setBusy(false);
        setMsg({ kind: "err", text: j?.error || "Falha ao agendar. Tente novamente." });
        return;
      }
      updatePost(id, { status: j.status || (publishNow ? "publicado" : "agendado") });
      setBusy(false);
      const ign =
        Array.isArray(j.canaisIgnorados) && j.canaisIgnorados.length
          ? ` · ignorados (sem publicação): ${j.canaisIgnorados.join(", ")}`
          : "";
      setMsg({ kind: "ok", text: (j.status === "publicado" ? "Publicado" : "Agendado") + " com sucesso" + ign });
      setTimeout(() => set({ postModal: null }), 1000); // set é ação da store — seguro após unmount
    } catch {
      setBusy(false);
      setMsg({ kind: "err", text: "Erro de rede ao agendar. Tente novamente." });
    }
  };

  const doDelete = () => {
    if (pm.id) deletePost(pm.id);
    close();
  };

  // Canais-alvo de publicação = redes REALMENTE conectadas na Zernio (twitter → x).
  // Guarda o id da rede em post.contas (mantém o shape usado pela fila/chips do calendário).
  const conn = redesConectadas(zernioAccounts);

  // Opções dos seletores vêm dos canais/perfis conectados; preserva o valor atual (edição).
  const canalOptions =
    f.canal && !canais.some((c) => c.nome === f.canal)
      ? [f.canal, ...canais.map((c) => c.nome)]
      : canais.map((c) => c.nome);
  const perfilOptions = f.perfil && !perfis.includes(f.perfil) ? [f.perfil, ...perfis] : perfis;
  const colabOptions = f.colab && !perfis.includes(f.colab) ? [f.colab, ...perfis] : perfis;

  const sel = (id: string, arr: string[], val: string, onChange: (v: string) => void) => (
    <select className="field-edit" id={id} value={val} onChange={(e) => onChange(e.target.value)}>
      {arr.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <div
      className="pm-back"
      id="pmBack"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="pm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <b>{pm.mode === "edit" ? "Editar post" : "Novo post"}</b>
          <button className="pm-x" id="pmClose" aria-label="Fechar" onClick={close}>
            ✕
          </button>
        </div>
        <div className="pm-body">
          <div className="pm-row">
            <div>
              <label className="field-lbl">Data</label>
              <input
                className="field-edit"
                id="pmData"
                value={f.data}
                placeholder="dd/mm/aaaa"
                onChange={(e) => upd({ data: e.target.value })}
              />
            </div>
            <div>
              <label className="field-lbl">Horário</label>
              <input
                className="field-edit"
                id="pmHora"
                value={f.hora}
                placeholder="hh:mm"
                onChange={(e) => upd({ hora: e.target.value })}
              />
            </div>
          </div>
          <label className="field-lbl">Título</label>
          <input
            className="field-edit"
            id="pmTitulo"
            value={f.titulo}
            placeholder="Título do post"
            onChange={(e) => upd({ titulo: e.target.value })}
          />
          <div className="pm-row">
            <div>
              <label className="field-lbl">Canal</label>
              {sel("pmCanal", canalOptions, f.canal, (v) => upd({ canal: v }))}
            </div>
            <div>
              <label className="field-lbl">Formato</label>
              {sel("pmFormato", FORMATOS_POST, f.formato, (v) => upd({ formato: v }))}
            </div>
          </div>
          <div className="pm-row">
            <div>
              <label className="field-lbl">Perfil</label>
              <select
                className="field-edit"
                id="pmPerfil"
                value={f.perfil}
                onChange={(e) => upd({ perfil: e.target.value })}
              >
                {perfilOptions.length === 0 && <option value="">— nenhum perfil conectado —</option>}
                {perfilOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-lbl">Perfil colaborador</label>
              <select
                className="field-edit"
                id="pmColab"
                value={f.colab}
                onChange={(e) => upd({ colab: e.target.value })}
              >
                <option value="">— nenhum —</option>
                {colabOptions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="pm-row">
            <div>
              <label className="field-lbl">Pilar / categoria</label>
              {sel("pmPilar", PILARES_POST, f.pilar, (v) => upd({ pilar: v }))}
            </div>
            <div>
              <label className="field-lbl">Funil</label>
              {sel("pmFunil", FUNIL_POST, f.funil, (v) => upd({ funil: v }))}
            </div>
          </div>
          <label className="field-lbl">Mídia (imagem, vídeo, gif ou pdf)</label>
          <input
            ref={fileRef}
            type="file"
            id="pmArquivo"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) onPickFile(file); }}
          />
          <button
            type="button"
            className="field-edit"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ textAlign: "left", cursor: uploading ? "default" : "pointer", color: uploading ? "var(--label-3)" : "var(--cyan)", fontWeight: 600 }}
          >
            {uploading ? "Enviando arquivo…" : "＋ Enviar arquivo"}
          </button>
          {f.media.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {f.media.map((m) => (
                <div key={m.url} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid var(--hairline)", borderRadius: 10, background: "var(--surface)" }}>
                  {m.type === "image" || m.type === "gif" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt={m.filename || ""} style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover" }} />
                  ) : (
                    <span style={{ width: 34, height: 34, borderRadius: 6, display: "grid", placeItems: "center", background: "var(--cream)", fontSize: 11, fontWeight: 700, color: "var(--label-2)" }}>
                      {m.type === "video" ? "▶" : "PDF"}
                    </span>
                  )}
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.filename || m.url}</span>
                  <button type="button" onClick={() => removeMedia(m.url)} style={{ border: 0, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 13 }} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          )}
          <label className="field-lbl">Legenda</label>
          <textarea
            className="field-edit"
            id="pmLegenda"
            rows={3}
            placeholder="Legenda da publicação"
            value={f.legenda}
            onChange={(e) => upd({ legenda: e.target.value })}
          />
          <div className="pm-row">
            <div>
              <label className="field-lbl">CTA</label>
              <input
                className="field-edit"
                id="pmCta"
                value={f.cta}
                placeholder="Ex.: Agende uma visita"
                onChange={(e) => upd({ cta: e.target.value })}
              />
            </div>
            <div>
              <label className="field-lbl">Hashtags</label>
              <input
                className="field-edit"
                id="pmHash"
                value={f.hashtags}
                placeholder="#seahub"
                onChange={(e) => upd({ hashtags: e.target.value })}
              />
            </div>
          </div>
          <div className="pm-sched">
            <div className="pm-sched-h">
              Agendamento &amp; publicação
              {existing?.status === "publicado" && (
                <span className="pm-pubtag">publicado ✓ {existing.hora || ""}</span>
              )}
              {existing?.status === "agendado" && (
                <span className="pm-schedtag">agendado · {existing.hora || "--:--"}</span>
              )}
            </div>
            <label className="field-lbl">Publicar em (canais conectados)</label>
            {conn.length ? (
              <div className="pm-contas">
                {conn.map((r) => {
                  const chk = f.contas.includes(r.id);
                  return (
                    <label className="pm-conta" key={r.id}>
                      <input
                        type="checkbox"
                        data-pmconta={r.id}
                        checked={chk}
                        onChange={(e) =>
                          upd({
                            contas: e.target.checked
                              ? [...f.contas, r.id]
                              : f.contas.filter((x) => x !== r.id),
                          })
                        }
                      />
                      <span className="conta-dot" style={{ background: r.cor }} />
                      {r.label}
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="pm-hint">
                Nenhum canal conectado. Conecte canais em Personalização (ou na barra &quot;Canais
                conectados&quot; no topo do calendário) para agendar publicação automática.
              </div>
            )}
            <label className="field-lbl">Status</label>
            <select
              className="field-edit"
              id="pmStatus"
              value={f.status}
              onChange={(e) => upd({ status: e.target.value })}
            >
              {Object.keys(POST_STATUS).map((k) => (
                <option key={k} value={k}>
                  {POST_STATUS[k].label}
                </option>
              ))}
            </select>
            {msg && <div className={`pm-msg pm-msg-${msg.kind}`}>{msg.text}</div>}
          </div>
        </div>
        <div className="pm-foot">
          {pm.mode === "edit" ? (
            <button className="btn-link pm-del" id="pmDelete" onClick={doDelete}>
              Excluir
            </button>
          ) : (
            <span></span>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-link" id="pmCancel" onClick={close} disabled={busy}>
              Cancelar
            </button>
            <button className="btn-link" id="pmSave" onClick={() => doSave()} disabled={busy}>
              Salvar
            </button>
            {/* Disparo real via Zernio (POST /posts) */}
            <button className="btn-link pm-pub" id="pmPublish" onClick={() => doPublish(true)} disabled={busy || uploading}>
              {busy ? "Enviando…" : "Publicar agora"}
            </button>
            <button className="btn-link ig" id="pmSchedule" onClick={() => doPublish(false)} disabled={busy || uploading}>
              {busy ? "Agendando…" : "Agendar publicação"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
