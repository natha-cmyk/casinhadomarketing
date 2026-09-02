"use client";
// Porta renderPostModal (blueprint 1475-1504) + savePost (1505-1515).
// Modal de criação/edição de post do calendário de conteúdo.
import { useEffect, useRef, useState } from "react";
import { useStore, newId, type PostItem, type PostMedia, type PostOverride } from "@/lib/store";
import { savePosts, deletePostApi } from "@/lib/api";
import { MediaCropModal, type CropTarget } from "@/components/views/MediaCropModal";
import { Ic } from "@/components/Ic";
import { ICONS } from "@/lib/nav";
import { PostPreview } from "@/components/views/PostPreview";
import { FeedGridPreview } from "@/components/views/FeedGridPreview";
import {
  CANAL_POST_COLORS,
  PILARES_POST,
  FORMATOS_POST,
  FUNIL_POST,
  REDES,
} from "@/lib/seed-data";

// plataforma Zernio → id da rede (Casinha): twitter → x
const PLAT_REV: Record<string, string> = { twitter: "x" };
// Canais manuais de conteúdo agora vêm do store (store.calManuais). Só registro, sem publicação síncrona.

type ZAccount = {
  _id?: string;
  platform: string;
  displayName?: string;
  username?: string;
  enabled?: boolean;
  adsStatus?: string;
  profilePicture?: string;
};

// id da rede (Casinha) de uma conta Zernio (twitter→x).
const redeIdOf = (a: ZAccount) => PLAT_REV[a.platform] || a.platform;

// Contas SOCIAIS realmente conectadas = enabled === true e a rede não é "ads".
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

// Canais = redes conectadas + canais MANUAIS do usuário (store). Cada um com sua cor.
function canaisConectados(accounts: ZAccount[], manuais: string[]): { nome: string; cor: string }[] {
  const redes = redesConectadas(accounts).map((r) => ({ nome: r.label, cor: r.cor }));
  const man = manuais.map((nome) => ({ nome, cor: CANAL_POST_COLORS[nome] || "#8E8E93" }));
  return [...redes, ...man];
}

// Perfis conectados = um por conta social habilitada (displayName/username). Multi-conta.
function perfisConectados(accounts: ZAccount[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of contasSociais(accounts)) {
    const rede = REDES.find((r) => r.id === redeIdOf(a));
    const nome = (a.displayName || a.username || rede?.label || a.platform || "").trim();
    if (!nome || seen.has(nome)) continue;
    seen.add(nome);
    out.push(nome);
  }
  return out;
}

// id da rede (Casinha) → plataforma Zernio (x → twitter).
const platOfRede = (id: string) => (id === "x" ? "twitter" : id);

// Formatos válidos por canal (rótulo da rede). Canal manual / desconhecido → lista completa.
const FORMATS_BY_CANAL: Record<string, string[]> = {
  Instagram: ["Reels", "Carrossel", "Post único", "Story"],
  Facebook: ["Reels", "Carrossel", "Post único", "Story"],
  TikTok: ["Vídeo", "Story"],
  YouTube: ["Short", "Vídeo"],
  LinkedIn: ["Post único", "Carrossel", "Vídeo", "Artigo"],
  X: ["Post único", "Thread", "Vídeo"],
  Threads: ["Post único", "Carrossel", "Vídeo"],
};
function formatosDoCanal(canalLabel: string): string[] {
  return FORMATS_BY_CANAL[canalLabel] || FORMATOS_POST;
}

// Sugestão automática de etapa do funil pelo formato + CTA. Manual continua mandando.
// CTA de ação forte → Fundo (conversão); alcance (reels/story/short) → Topo; educação → Meio.
function sugestaoFunil(formato: string, cta: string): string {
  const c = (cta || "").toLowerCase();
  if (/agend|visit|contrat|assin|compr|whats|fale|inscrev|garant|vaga|or[çc]ament|link na bio/.test(c)) return "Fundo";
  if (/reels|story|short|v[íi]deo/i.test(formato)) return "Topo";
  if (/carrossel|post|artigo|thread|blog/i.test(formato)) return "Meio";
  return "Topo";
}

// Perfis conectados FILTRADOS pela plataforma do canal escolhido. Canal manual/sem rede → todos.
function perfisDoCanal(accounts: ZAccount[], canalLabel: string): string[] {
  const rede = REDES.find((r) => r.label === canalLabel);
  if (!rede) return []; // canal manual → sem perfil social forçado
  const plat = platOfRede(rede.id);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of contasSociais(accounts)) {
    if (a.platform !== plat) continue;
    const nome = (a.displayName || a.username || rede.label || a.platform || "").trim();
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
  notas: string;
  linkRef: string;
  roteiro: string;
  overrides: Record<string, PostOverride>;
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

// ícone (glifo) da rede a partir do rótulo do canal; null p/ canal manual (sem marca).
const CANAL_ICON_BY_ID: Record<string, string> = { instagram: "ig", x: "x" };
function iconeDoCanal(nome: string): string | null {
  const rede = REDES.find((r) => r.label === nome);
  if (!rede) return null;
  const key = CANAL_ICON_BY_ID[rede.id] || rede.id;
  return ICONS[key] ? key : null;
}
// glifo por id de rede (usado nos chips de "Publicar em")
function iconeDoRedeId(id: string): string | null {
  const key = CANAL_ICON_BY_ID[id] || id;
  return ICONS[key] ? key : null;
}
// inicial "limpa" p/ canal manual (ignora colchetes/prefixos tipo "[GW]")
const inicialLimpa = (nome: string): string => {
  const m = nome.replace(/\[[^\]]*\]/g, "").replace(/[^A-Za-zÀ-ÿ0-9]/g, " ").trim();
  return (m[0] || nome[0] || "?").toUpperCase();
};

// Etapa 1 do novo post: grade de canais conectados. Escolher um leva ao composer adaptado à rede.
function ChannelPickerModal({ canais, onClose, onPick }: { canais: { nome: string; cor: string }[]; onClose: () => void; onPick: (nome: string) => void }) {
  return (
    <div className="pm-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="pm-head">
          <b>Novo post · escolha o canal</b>
          <button className="pm-x" aria-label="Fechar" onClick={onClose}>✕</button>
        </div>
        <div className="pm-body">
          <div style={{ fontSize: 13, color: "var(--label-2)", marginBottom: 14 }}>Pra onde vai esse conteúdo? O editor se adapta à rede escolhida (formatos, perfil, capa e legenda daquela plataforma).</div>
          {canais.length === 0 ? (
            <div className="pm-hint">Nenhum canal conectado ainda. Conecte em Personalização → Conexões.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12 }}>
              {canais.map((c) => {
                const ic = iconeDoCanal(c.nome);
                return (
                  <button key={c.nome} type="button" onClick={() => onPick(c.nome)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "18px 12px", border: "1.5px solid var(--hairline)", borderRadius: 14, background: "#fff", cursor: "pointer", transition: ".14s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.cor; e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--hairline)"; e.currentTarget.style.boxShadow = "none"; }}>
                    <span className="pm-pick-ic" style={{ background: c.cor, color: "#fff" }}>
                      {ic ? <Ic name={ic} /> : inicialLimpa(c.nome)}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--label)", textAlign: "center", lineHeight: 1.25 }}>{c.nome}</span>
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

export function PostModal() {
  const pm = useStore((st) => st.postModal);
  const posts = useStore((st) => st.posts);
  const zernioAccounts = useStore((st) => st.zernioAccounts);
  const calManuais = useStore((st) => st.calManuais);
  const calMonth = useStore((st) => st.calMonth);
  const calYear = useStore((st) => st.calYear);
  const calCanal = useStore((st) => st.calCanal);
  const calPerfil = useStore((st) => st.calPerfil);
  const calDefaults = useStore((st) => st.calDefaults);
  const setCalDefault = useStore((st) => st.setCalDefault);
  const calOpcoes = useStore((st) => st.calOpcoes);
  const addCalOpcao = useStore((st) => st.addCalOpcao);
  const set = useStore((st) => st.set);
  const addPost = useStore((st) => st.addPost);
  const updatePost = useStore((st) => st.updatePost);
  const deletePost = useStore((st) => st.deletePost);

  // Fonte única (auto-sincroniza quando novas contas conectam) + manuais do usuário:
  const canais = canaisConectados(zernioAccounts, calManuais);
  const perfisAll = perfisConectados(zernioAccounts);

  const existing = pm && pm.mode === "edit" ? posts.find((x) => x.id === pm.id) : undefined;

  // Estado do disparo real (agendar/publicar via Zernio).
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  // Upload de mídia (presign Zernio → PUT direto no storage)
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null); // % do upload atual (null = sem barra)
  const [uploadNome, setUploadNome] = useState<string>("");        // nome do arquivo em envio
  const [dragOver, setDragOver] = useState(false);                 // destaque da zona de drop
  const [prevMode, setPrevMode] = useState<"post" | "feed">("post"); // aba do preview: publicação x grade do feed
  const [feedRecent, setFeedRecent] = useState<{ thumbnail: string | null; url: string | null; isVideo?: boolean }[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [coverBusy, setCoverBusy] = useState<"" | "up" | "frame">(""); // envio/captura da capa do vídeo
  const [coverErr, setCoverErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  // guarda o File local por url (pra recorte sem taint de CORS) + alvo do editor de recorte
  const filesByUrl = useRef<Map<string, File>>(new Map());
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  // Fluxo do "novo post": primeiro ESCOLHE O CANAL, depois abre o composer adaptado àquela rede.
  // Edição já entra direto no composer (canal definido). "trocar canal" volta pra etapa 1.
  const [step, setStep] = useState<"canal" | "composer">(pm?.mode === "edit" ? "composer" : "canal");

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
        notas: existing.notas ?? "",
        linkRef: existing.linkRef ?? "",
        roteiro: existing.roteiro ?? "",
        overrides: existing.overrides ? { ...existing.overrides } : {},
        status: existing.status,
        contas: [...(existing.contas || [])],
      };
    }
    const y = pm?.y ?? calYear;
    const m = pm?.m ?? calMonth;
    const d = pm?.d ?? 1;
    // herda o canal/perfil da visualização atual do calendário (se filtrada)
    const canalPre = calCanal !== "todos" && canais.some((c) => c.nome === calCanal) ? calCanal : canais[0]?.nome ?? "Instagram";
    const perfisPre = perfisDoCanal(zernioAccounts, canalPre);
    const redePre = REDES.find((r) => r.label === canalPre);
    const ridPre = redePre && redesConectadas(zernioAccounts).some((r) => r.id === redePre.id) ? redePre.id : null;
    // perfil inicial: filtro da visualização > perfil PADRÃO do canal > 1º perfil do canal
    const defPre = ridPre ? calDefaults[ridPre] : undefined;
    const perfilPre =
      calPerfil !== "todos" && perfisPre.includes(calPerfil) ? calPerfil
      : defPre && perfisPre.includes(defPre) ? defPre
      : perfisPre[0] ?? "";
    return {
      data: String(d).padStart(2, "0") + "/" + String(m + 1).padStart(2, "0") + "/" + y,
      hora: "09:00",
      titulo: "",
      canal: canalPre,
      formato: formatosDoCanal(canalPre)[0] ?? "Reels",
      perfil: perfilPre,
      colab: "",
      pilar: "Espaços",
      funil: "Topo",
      arquivo: "",
      media: [],
      legenda: "",
      cta: "",
      hashtags: "",
      notas: "",
      linkRef: "",
      roteiro: "",
      overrides: {},
      status: "rascunho",
      contas: ridPre ? [ridPre] : [],
    };
  });

  // horários SUGERIDOS (melhores horários da conta, via Zernio best-time) pro canal/perfil atual
  const [sugHoras, setSugHoras] = useState<string[]>([]);
  useEffect(() => {
    const rede = REDES.find((r) => r.label === f.canal);
    const plat = rede ? platOfRede(rede.id) : null;
    const acc = plat
      ? (zernioAccounts as ZAccount[]).find((a) => a.platform === plat && (a.displayName || a.username) === f.perfil)
      : null;
    if (!acc?._id || !plat) { setSugHoras([]); return; }
    let alive = true;
    fetch(`/api/zernio/besttime?accountId=${encodeURIComponent(acc._id)}&platform=${encodeURIComponent(plat)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const slots: { hour: number; avg_engagement: number }[] = Array.isArray(d?.slots) ? d.slots : [];
        const byHour = new Map<number, { sum: number; n: number }>();
        for (const s of slots) {
          const e = byHour.get(s.hour) || { sum: 0, n: 0 };
          e.sum += s.avg_engagement || 0; e.n += 1; byHour.set(s.hour, e);
        }
        const top = [...byHour.entries()]
          .map(([h, v]) => ({ h, avg: v.sum / (v.n || 1) }))
          .sort((a, b) => b.avg - a.avg) // pega as 6 horas de MAIOR engajamento
          .slice(0, 6)
          .sort((a, b) => a.h - b.h) // …mas exibe em ORDEM cronológica
          .map((x) => String(x.h).padStart(2, "0") + ":00");
        setSugHoras(top);
      })
      .catch(() => { if (alive) setSugHoras([]); });
    return () => { alive = false; };
  }, [f.canal, f.perfil, zernioAccounts]);

  // Planejador de grade: busca o feed real do perfil (posts recentes) quando a aba "Feed" abre.
  useEffect(() => {
    if (prevMode !== "feed") return;
    const acc = zernioAccounts.find((a) => a.username === f.perfil || a.displayName === f.perfil);
    const rede = REDES.find((r) => r.label === f.canal);
    const plat = rede ? (rede.id === "x" ? "twitter" : rede.id) : "";
    if (!acc?._id || !plat) { setFeedRecent([]); return; }
    let alive = true;
    setFeedLoading(true);
    fetch(`/api/zernio/insights?platform=${plat}&accountId=${acc._id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setFeedRecent(Array.isArray(d?.recent) ? d.recent : []); })
      .catch(() => { if (alive) setFeedRecent([]); })
      .finally(() => { if (alive) setFeedLoading(false); });
    return () => { alive = false; };
  }, [prevMode, f.perfil, f.canal, zernioAccounts]);

  if (!pm) return null;
  if (pm.mode === "edit" && !existing) return null;

  const upd = (patch: Partial<Fields>) => setF((prev) => ({ ...prev, ...patch }));

  // perfis e formatos VÁLIDOS pro canal escolhido (produtora: canal filtra perfis + formatos)
  const perfis = perfisDoCanal(zernioAccounts, f.canal);
  const formatos = formatosDoCanal(f.canal);

  // id da rede CONECTADA correspondente ao rótulo do canal (null se manual/não conectada)
  const redeIdDoCanal = (canalLabel: string): string | null => {
    const rede = REDES.find((r) => r.label === canalLabel);
    if (!rede) return null;
    return redesConectadas(zernioAccounts).some((r) => r.id === rede.id) ? rede.id : null;
  };

  // trocar de canal reseta perfil e formato pros válidos daquele canal (evita "IG com perfil do TikTok")
  // e já MARCA o checkbox de "Publicar em" da rede correspondente.
  const onCanalChange = (canal: string) => {
    const p = perfisDoCanal(zernioAccounts, canal);
    const fmt = formatosDoCanal(canal);
    const rid = redeIdDoCanal(canal);
    const def = rid ? calDefaults[rid] : undefined;
    const isManual = calManuais.includes(canal);
    setF((prev) => ({
      ...prev,
      canal,
      perfil: p.includes(prev.perfil) ? prev.perfil : def && p.includes(def) ? def : p[0] ?? "",
      formato: fmt.includes(prev.formato) ? prev.formato : fmt[0] ?? "",
      // marca SÓ o canal escolhido (manual = nenhum). Se quiser mais canais, marca à mão depois.
      contas: isManual ? [] : rid ? [rid] : [],
    }));
  };

  // Upload real: presign na nossa API → PUT do arquivo DIRETO no storage (não passa
  // pelo servidor → sem limite de 4.5MB) → guarda publicUrl como MediaItem.
  // PUT com barra de progresso real (XHR expõe upload.onprogress; fetch não).
  const putComProgresso = (url: string, body: Blob, contentType: string, onPct: (p: number) => void) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("content-type", contentType);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload falhou (${xhr.status})`)));
      xhr.onerror = () => reject(new Error("falha de rede no upload"));
      xhr.send(body);
    });

  const onPickFile = async (file: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setUploadNome(file.name);
    setUploadPct(0);
    setMsg(null);
    try {
      const pres = await fetch("/api/posts/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
      });
      const pj = await pres.json().catch(() => null);
      if (!pres.ok || !pj?.uploadUrl) throw new Error(pj?.error || "não foi possível preparar o upload");
      await putComProgresso(pj.uploadUrl, file, file.type, setUploadPct);
      const item: PostMedia = { type: mimeToType(file.type), url: pj.publicUrl, filename: file.name, mimeType: file.type, size: file.size };
      filesByUrl.current.set(pj.publicUrl, file); // guarda p/ recorte sem CORS
      setF((prev) => ({ ...prev, media: [...prev.media, item], arquivo: prev.arquivo || file.name }));
      setMsg({ kind: "ok", text: `“${file.name}” enviado ✓` });
    } catch (e) {
      setMsg({ kind: "err", text: `Falha no upload: ${String((e as Error)?.message || e).slice(0, 90)}` });
    } finally {
      setUploading(false);
      setUploadPct(null);
      setUploadNome("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  // Vários arquivos de uma vez (carrossel): envia em sequência, cada um vira 1 mídia do MESMO post.
  const onPickFiles = async (files: FileList) => {
    const arr = Array.from(files);
    for (const file of arr) {
      // eslint-disable-next-line no-await-in-loop
      await onPickFile(file);
    }
    if (arr.length > 1) setMsg({ kind: "ok", text: `${arr.length} arquivos enviados ✓ (viram um carrossel no mesmo post)` });
  };
  const removeMedia = (url: string) => setF((prev) => ({ ...prev, media: prev.media.filter((m) => m.url !== url) }));

  // upload de um Blob (usado pelo recorte) → publicUrl
  const uploadBlob = async (blob: Blob, filename: string, contentType: string): Promise<string> => {
    const pres = await fetch("/api/posts/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename, contentType, size: blob.size }) });
    const pj = await pres.json().catch(() => null);
    if (!pres.ok || !pj?.uploadUrl) throw new Error(pj?.error || "não foi possível preparar o upload");
    const put = await fetch(pj.uploadUrl, { method: "PUT", headers: { "content-type": contentType }, body: blob });
    if (!put.ok) throw new Error(`upload falhou (${put.status})`);
    return pj.publicUrl as string;
  };

  // capa (thumbnail) do vídeo: grava no media[i].thumbnail
  const setThumb = (mUrl: string, thumb: string) =>
    setF((prev) => ({ ...prev, media: prev.media.map((x) => (x.url === mUrl ? { ...x, thumbnail: thumb || undefined } : x)) }));
  // enviar capa (imagem)
  const pickCover = async (mUrl: string, file: File) => {
    setCoverBusy("up"); setCoverErr(null);
    try { const url = await uploadBlob(file, file.name, file.type); setThumb(mUrl, url); }
    catch (e) { setCoverErr(String((e as Error)?.message || e).slice(0, 100)); }
    finally { setCoverBusy(""); if (coverRef.current) coverRef.current.value = ""; }
  };
  // capturar um FRAME do vídeo como capa (usa o arquivo local quando há, evitando CORS)
  const capturarFrame = async (m: PostMedia) => {
    setCoverBusy("frame"); setCoverErr(null);
    try {
      const localFile = filesByUrl.current.get(m.url);
      const src = localFile ? URL.createObjectURL(localFile) : m.url;
      const video = document.createElement("video");
      if (!localFile) video.crossOrigin = "anonymous";
      video.src = src; video.muted = true; (video as HTMLVideoElement).playsInline = true;
      await new Promise<void>((res, rej) => { video.onloadeddata = () => res(); video.onerror = () => rej(new Error("não consegui abrir o vídeo")); });
      const t = isFinite(video.duration) && video.duration ? video.duration / 2 : 1;
      await new Promise<void>((res) => { video.onseeked = () => res(); video.currentTime = Math.min(t, Math.max(0, (video.duration || 2) - 0.1)); });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720; canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas indisponível");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.9));
      if (localFile) URL.revokeObjectURL(src);
      if (!blob) throw new Error("não consegui capturar o frame (vídeo pode estar protegido). Reenvie o vídeo neste mesmo modal e tente de novo.");
      const url = await uploadBlob(blob, "capa.jpg", "image/jpeg");
      setThumb(m.url, url);
    } catch (e) { setCoverErr(String((e as Error)?.message || e).slice(0, 130)); }
    finally { setCoverBusy(""); }
  };
  // salva o recorte: sobe a imagem recortada e troca a mídia original por ela
  const onCropSave = async (blob: Blob) => {
    if (!cropTarget) return;
    const oldUrl = cropTarget.url;
    const baseName = (cropTarget.filename || "recorte").replace(/\.[^.]+$/, "");
    const filename = `${baseName}-crop.jpg`;
    const newUrl = await uploadBlob(blob, filename, "image/jpeg");
    filesByUrl.current.set(newUrl, new File([blob], filename, { type: "image/jpeg" }));
    setF((prev) => ({
      ...prev,
      media: prev.media.map((m) => (m.url === oldUrl ? { type: "image", url: newUrl, filename, mimeType: "image/jpeg", size: blob.size } : m)),
    }));
    setCropTarget(null);
    setMsg({ kind: "ok", text: "Imagem recortada aplicada ✓" });
  };

  const close = () => set({ postModal: null });

  // ETAPA 1 (novo post): escolher o canal. O composer só abre depois — já adaptado à rede.
  if (step === "canal") {
    return (
      <ChannelPickerModal
        canais={canais}
        onClose={close}
        onPick={(nome) => { onCanalChange(nome); setStep("composer"); }}
      />
    );
  }

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
      notas: f.notas,
      linkRef: f.linkRef,
      roteiro: f.roteiro,
      overrides: f.overrides,
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
        if (j?.detail) console.error("[publish] detalhe:", j.detail);
        setMsg({ kind: "err", text: (j?.error || "Falha ao agendar. Tente novamente.") + (j?.detail ? ` — ${String(j.detail).slice(0, 160)}` : "") });
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
    if (pm.id) {
      const id = pm.id;
      deletePost(id);
      void deletePostApi(id); // remoção explícita no banco (salvar é só upsert)
    }
    close();
  };

  // Canais-alvo de publicação = redes REALMENTE conectadas na Zernio (twitter → x).
  // Guarda o id da rede em post.contas (mantém o shape usado pela fila/chips do calendário).
  const conn = redesConectadas(zernioAccounts);

  // dados pro PREVIEW (avatar do perfil escolhido + 1ª mídia). Legenda do canal atual (override > geral).
  // canal com grade de feed (planejador só faz sentido em redes de grade)
  const feedGridCanal = (() => { const rede = REDES.find((r) => r.label === f.canal); return !!rede && ["instagram", "tiktok", "facebook", "threads"].includes(rede.id); })();
  const prevAcct = zernioAccounts.find((a) => a.username === f.perfil || a.displayName === f.perfil);
  const ridPrev = redeIdDoCanal(f.canal);
  const prevLegenda = (ridPrev && f.overrides[ridPrev]?.caption) || f.legenda;
  const previewNode = (
    <PostPreview
      canal={f.canal}
      formato={f.formato}
      perfil={f.perfil}
      avatarUrl={prevAcct?.profilePicture}
      legenda={prevLegenda}
      hashtags={f.hashtags}
      media={f.media[0]}
      titulo={f.titulo}
      pilar={f.pilar}
      funil={f.funil}
    />
  );

  // Opções dos seletores vêm dos canais/perfis conectados; preserva o valor atual (edição).
  const canalOptions =
    f.canal && !canais.some((c) => c.nome === f.canal)
      ? [f.canal, ...canais.map((c) => c.nome)]
      : canais.map((c) => c.nome);
  const dedupe = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
  const formatoOptions = dedupe([...(f.formato ? [f.formato] : []), ...formatos, ...calOpcoes.formatos]);
  const pilarOptions = dedupe([...(f.pilar ? [f.pilar] : []), ...PILARES_POST, ...calOpcoes.pilares]);
  const perfilOptions = f.perfil && !perfis.includes(f.perfil) ? [f.perfil, ...perfis] : perfis;

  // seletor com opção "➕ Novo…" que cria e já fixa a opção (persistida no config)
  const onPick = (tipo: "pilares" | "formatos", v: string, setter: (x: string) => void) => {
    if (v === "__novo__") {
      const nome = (window.prompt(tipo === "pilares" ? "Novo pilar de conteúdo:" : "Novo formato:") || "").trim();
      if (nome) { addCalOpcao(tipo, nome); setter(nome); }
      return;
    }
    setter(v);
  };

  const sel = (id: string, arr: string[], val: string, onChange: (v: string) => void) => (
    <select className="field-edit" id={id} value={val} onChange={(e) => onChange(e.target.value)}>
      {arr.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );

  return (
    <>
    {cropTarget && <MediaCropModal target={cropTarget} onCancel={() => setCropTarget(null)} onSave={onCropSave} />}
    <div
      className="pm-back"
      id="pmBack"
      onClick={(e) => {
        if (uploading) return; // não fecha por engano enquanto envia mídia
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="pm pm-wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pm-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <b>{pm.mode === "edit" ? "Editar post" : "Novo post"}</b>
            <span className="pm-canal-chip" style={{ background: (canais.find((c) => c.nome === f.canal)?.cor) || "var(--ink)" }}>{f.canal}</span>
            {pm.mode === "new" && (
              <button type="button" className="btn-link" style={{ fontSize: 12 }} onClick={() => setStep("canal")}>← trocar canal</button>
            )}
          </div>
          <button className="pm-x" id="pmClose" aria-label="Fechar" onClick={close}>
            ✕
          </button>
        </div>
        <div className="pm-main">
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
            <div className="pm-hora-wrap">
              <label className="field-lbl">Horário{sugHoras.length > 0 && <span title="Melhores horários disponíveis — passe o mouse" style={{ color: "var(--cyan)", marginLeft: 4, cursor: "help" }}>★</span>}</label>
              <input
                className="field-edit"
                id="pmHora"
                value={f.hora}
                placeholder="hh:mm"
                onChange={(e) => upd({ hora: e.target.value })}
              />
              {sugHoras.length > 0 && (
                <select
                  className="field-edit pm-hora-sug"
                  style={{ marginTop: 5, fontSize: 12.5, borderRadius: 10 }}
                  value=""
                  onChange={(e) => { if (e.target.value) upd({ hora: e.target.value }); }}
                  title={`Melhores horários pra postar no ${f.canal}, calculados pelo engajamento histórico das suas publicações nesse canal. Ordenados por horário.`}
                >
                  <option value="">★ Melhores horários…</option>
                  {sugHoras.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              )}
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
              {sel("pmCanal", canalOptions, f.canal, onCanalChange)}
              {calManuais.includes(f.canal) && (
                <div className="pm-hint" style={{ marginTop: 6 }}>
                  Canal manual — só registro de conteúdo. Não há publicação automática por aqui.
                </div>
              )}
            </div>
            <div>
              <label className="field-lbl">Formato</label>
              <select className="field-edit" id="pmFormato" value={f.formato} onChange={(e) => onPick("formatos", e.target.value, (v) => upd({ formato: v }))}>
                {formatoOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value="__novo__">➕ Novo formato…</option>
              </select>
            </div>
          </div>
          <div className="pm-row">
            <div className="pm-perfil-wrap">
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
              {(() => {
                const rid = redeIdDoCanal(f.canal);
                if (!rid || perfis.length < 2 || !f.perfil) return null;
                const isDef = calDefaults[rid] === f.perfil;
                // só aparece ao passar o mouse / focar o seletor de perfil (menos poluição)
                return (
                  <button
                    type="button"
                    className="pm-def-toggle"
                    onClick={() => setCalDefault(rid, isDef ? "" : f.perfil)}
                    style={{ color: isDef ? "var(--cyan)" : "var(--label-3)" }}
                    title="Perfil que já vem selecionado quando você escolher este canal"
                  >
                    {isDef ? "★ perfil padrão deste canal" : "☆ tornar perfil padrão deste canal"}
                  </button>
                );
              })()}
            </div>
            <div>
              <label className="field-lbl">Perfil colaborador</label>
              <input
                className="field-edit"
                id="pmColab"
                list="pmColabList"
                value={f.colab}
                placeholder="@qualquer perfil (colab)"
                onChange={(e) => upd({ colab: e.target.value })}
              />
              <datalist id="pmColabList">
                {perfisAll.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="pm-row">
            <div>
              <label className="field-lbl">Pilar / categoria</label>
              <select className="field-edit" id="pmPilar" value={f.pilar} onChange={(e) => onPick("pilares", e.target.value, (v) => upd({ pilar: v }))}>
                {pilarOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                <option value="__novo__">➕ Novo pilar…</option>
              </select>
            </div>
            <div>
              <label className="field-lbl">Funil</label>
              {sel("pmFunil", FUNIL_POST, f.funil, (v) => upd({ funil: v }))}
              {(() => {
                const sug = sugestaoFunil(f.formato, f.cta);
                return sug !== f.funil ? (
                  <div className="pm-hint" style={{ marginTop: 6 }}>
                    Sugerido: <b>{sug}</b>{" "}
                    <button type="button" onClick={() => upd({ funil: sug })} style={{ border: 0, background: "transparent", color: "var(--cyan)", cursor: "pointer", fontWeight: 700, padding: 0 }}>
                      aplicar
                    </button>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
          <label className="field-lbl">Mídia (imagem, vídeo, gif ou pdf)</label>
          <input
            ref={fileRef}
            type="file"
            id="pmArquivo"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => { const files = e.target.files; if (files?.length) onPickFiles(files); }}
          />
          <div
            className={`pm-drop${dragOver ? " over" : ""}`}
            onClick={() => { if (!uploading) fileRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const files = e.dataTransfer.files; if (files?.length && !uploading) onPickFiles(files); }}
          >
            {uploading ? (
              <div style={{ width: "100%" }}>
                <div style={{ fontSize: 12.5, color: "var(--label-2)", marginBottom: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Enviando {uploadNome}…</span>
                  <b className="tnum">{uploadPct ?? 0}%</b>
                </div>
                <div className="pm-bar"><div className="pm-bar-fill" style={{ width: `${uploadPct ?? 0}%` }} /></div>
                <div style={{ fontSize: 10.5, color: "var(--label-3)", marginTop: 6 }}>Mantenha esta janela aberta até concluir.</div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "var(--cyan)" }}>＋ Enviar arquivo</div>
                <div style={{ fontSize: 11.5, color: "var(--label-3)", marginTop: 2 }}>ou arraste a mídia aqui</div>
              </div>
            )}
          </div>
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
                  {m.type === "image" && (
                    <button type="button" onClick={() => setCropTarget({ url: m.url, file: filesByUrl.current.get(m.url), filename: m.filename })} style={{ border: 0, background: "transparent", color: "var(--cyan)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Ajustar</button>
                  )}
                  <button type="button" onClick={() => removeMedia(m.url)} style={{ border: 0, background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 13 }} aria-label="Remover">✕</button>
                </div>
              ))}
            </div>
          )}
          {/* Capa (thumbnail) do vídeo — enviar imagem ou capturar um frame */}
          {(() => {
            const vid = f.media.find((m) => m.type === "video");
            if (!vid) return null;
            return (
              <div className="pm-ov-card" style={{ marginTop: 8 }}>
                <div className="pm-ov-head"><b>Capa do vídeo (thumbnail)</b></div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ width: 54, height: 54, borderRadius: 10, overflow: "hidden", background: "#0d0d0f", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                    {vid.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vid.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : <span style={{ color: "#fff", opacity: .5, fontSize: 16 }}>▶</span>}
                  </span>
                  <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) pickCover(vid.url, fl); }} />
                  <button className="btn-link ig" type="button" disabled={coverBusy !== ""} onClick={() => coverRef.current?.click()}>{coverBusy === "up" ? "Enviando…" : "Enviar capa"}</button>
                  <button className="btn-link" type="button" disabled={coverBusy !== ""} onClick={() => capturarFrame(vid)}>{coverBusy === "frame" ? "Capturando…" : "Capturar frame do vídeo"}</button>
                  {vid.thumbnail && <button className="btn-link" type="button" onClick={() => setThumb(vid.url, "")}>Remover</button>}
                </div>
                {coverErr && <div className="pm-msg pm-msg-err" style={{ marginTop: 6 }}>{coverErr}</div>}
                <div className="pm-hint" style={{ marginTop: 4 }}>Capa do vídeo (YouTube ≥3min, Reels, etc.). Envie uma imagem ou capture um frame do próprio vídeo.</div>
              </div>
            );
          })()}
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
          <label className="field-lbl">Notas de produção</label>
          <textarea
            className="field-edit"
            id="pmNotas"
            rows={2}
            placeholder="Anotações internas (não vão na publicação)"
            value={f.notas}
            onChange={(e) => upd({ notas: e.target.value })}
          />
          <div className="pm-row">
            <div>
              <label className="field-lbl">Link de referência</label>
              <input
                className="field-edit"
                id="pmLinkRef"
                value={f.linkRef}
                placeholder="https://… (inspiração/briefing)"
                onChange={(e) => upd({ linkRef: e.target.value })}
              />
            </div>
            <div>
              <label className="field-lbl">Roteiro (link do doc)</label>
              <input
                className="field-edit"
                id="pmRoteiro"
                value={f.roteiro}
                placeholder="https://docs… do roteiro"
                onChange={(e) => upd({ roteiro: e.target.value })}
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
            {calManuais.includes(f.canal) ? (
              <div className="pm-hint">⚠️ Canal manual — <b>sem publicação automática sincronizada</b>. Serve só como registro no calendário; a publicação é feita manualmente por você na plataforma do canal.</div>
            ) : conn.length ? (
              <>
                {/* chips lado a lado (ícone da rede) — selecionar marca o canal de publicação */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {conn.map((r) => {
                    const chk = f.contas.includes(r.id);
                    const ik = iconeDoRedeId(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className="pm-pubchip"
                        aria-pressed={chk}
                        data-pmconta={r.id}
                        onClick={() => upd({ contas: chk ? f.contas.filter((x) => x !== r.id) : [...f.contas, r.id] })}
                        style={chk ? { borderColor: r.cor, background: `${r.cor}14` } : undefined}
                        title={r.label}
                      >
                        <span className="pm-pubchip-ic" style={{ background: chk ? r.cor : "var(--surface)", color: chk ? "#fff" : "var(--label-2)" }}>
                          {ik ? <Ic name={ik} /> : (r.label[0] || "?")}
                        </span>
                        <span>{r.label}</span>
                        {chk && <span style={{ color: r.cor, fontWeight: 800 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                {/* opções específicas só dos canais SELECIONADos (legenda por canal / YouTube) */}
                {conn.filter((r) => f.contas.includes(r.id)).map((r) => {
                  const ov = f.overrides[r.id] || {};
                  const setOv = (patch: PostOverride) => upd({ overrides: { ...f.overrides, [r.id]: { ...ov, ...patch } } });
                  const mostraLegenda = f.contas.length > 1;
                  const isYt = r.id === "youtube";
                  if (!mostraLegenda && !isYt) return null;
                  const ik = iconeDoRedeId(r.id);
                  return (
                    <div key={r.id} className="pm-ov-card">
                      <div className="pm-ov-head">
                        <span className="pm-pubchip-ic" style={{ background: r.cor, color: "#fff", width: 22, height: 22 }}>{ik ? <Ic name={ik} /> : (r.label[0] || "?")}</span>
                        <b>{r.label}</b>
                      </div>
                      {mostraLegenda && (
                        <input className="field-edit" style={{ fontSize: 12.5 }} value={ov.caption ?? ""} placeholder={`Legenda só do ${r.label} (vazio = legenda geral)`} onChange={(e) => setOv({ caption: e.target.value })} />
                      )}
                      {isYt && (
                        <>
                          <input className="field-edit" style={{ fontSize: 12.5 }} maxLength={100} value={ov.ytTitle ?? ""} placeholder="Título do YouTube (≤100; vazio usa o título do post)" onChange={(e) => setOv({ ytTitle: e.target.value })} />
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <select className="field-edit" style={{ fontSize: 12.5, flex: 1 }} value={ov.ytVisibility ?? "public"} onChange={(e) => setOv({ ytVisibility: e.target.value })}>
                              <option value="public">Público</option>
                              <option value="unlisted">Não listado</option>
                              <option value="private">Privado</option>
                            </select>
                            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--label-2)", whiteSpace: "nowrap" }}>
                              <input type="checkbox" checked={!!ov.ytMadeForKids} onChange={(e) => setOv({ ytMadeForKids: e.target.checked })} />
                              infantil
                            </label>
                          </div>
                          <div className="pm-hint">Vídeo &lt;3min vira Short automaticamente. Capa custom só em vídeo ≥3min (o YouTube não permite em Short).</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </>
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
        <aside className="pm-preview-col">
          <div className="pm-prev-tabs">
            <button type="button" className={prevMode === "post" ? "on" : ""} onClick={() => setPrevMode("post")}>Publicação</button>
            {feedGridCanal && <button type="button" className={prevMode === "feed" ? "on" : ""} onClick={() => setPrevMode("feed")}>No feed</button>}
          </div>
          {prevMode === "feed" && feedGridCanal ? (
            <FeedGridPreview newMedia={f.media[0]} recent={feedRecent || []} loading={feedLoading} cor={(canais.find((c) => c.nome === f.canal)?.cor) || "var(--ink)"} />
          ) : (
            previewNode
          )}
        </aside>
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
            {/* Disparo real via Zernio (POST /posts) — canal manual não publica */}
            {!calManuais.includes(f.canal) && (
              <>
                <button className="btn-link pm-pub" id="pmPublish" onClick={() => doPublish(true)} disabled={busy || uploading}>
                  {busy ? "Enviando…" : "Publicar agora"}
                </button>
                <button className="btn-link ig" id="pmSchedule" onClick={() => doPublish(false)} disabled={busy || uploading}>
                  {busy ? "Agendando…" : "Agendar publicação"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
