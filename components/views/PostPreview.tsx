"use client";
// Preview do conteúdo ANTES de postar: mostra como o post fica no perfil da rede escolhida.
// Adapta o enquadramento pelo formato (vertical/quadrado/wide) e a "moldura" pela rede.
import { Ic } from "@/components/Ic";
import { ICONS } from "@/lib/nav";
import { REDES } from "@/lib/seed-data";
import type { PostMedia } from "@/lib/store";

const ICON_BY_ID: Record<string, string> = { instagram: "ig", x: "x" };
function iconKey(canalLabel: string): string | null {
  const rede = REDES.find((r) => r.label === canalLabel);
  if (!rede) return null;
  const k = ICON_BY_ID[rede.id] || rede.id;
  return ICONS[k] ? k : null;
}
function redeIdOf(canalLabel: string): string {
  return REDES.find((r) => r.label === canalLabel)?.id || "";
}

// proporção do quadro pelo formato/rede
function aspecto(canalLabel: string, formato: string): number {
  const f = (formato || "").toLowerCase();
  const id = redeIdOf(canalLabel);
  if (/reel|story|stories|short|tiktok|v[íi]deo vertical/.test(f)) return 9 / 16;
  if (id === "tiktok") return 9 / 16;
  if (id === "youtube") return 16 / 9;
  if (/carrossel|carousel|feed|post|est[áa]tico|imagem|foto/.test(f)) return 1;
  if (id === "instagram") return 1;
  if (id === "linkedin" || id === "x" || id === "facebook" || id === "threads") return 1.2;
  return 1;
}

function MediaFrame({ media, ratio, cor }: { media?: PostMedia; ratio: number; cor: string }) {
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: String(ratio), background: "#0d0d0f", overflow: "hidden", display: "grid", placeItems: "center" }}>
      {media?.url && media.type === "video" ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={media.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted playsInline />
      ) : media?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ textAlign: "center", color: "rgba(255,255,255,.55)", fontSize: 12, padding: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, margin: "0 auto 8px", background: cor, opacity: .85, display: "grid", placeItems: "center", color: "#fff" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M4 18l5-5 4 4 3-3 4 4" /></svg>
          </div>
          anexe uma mídia pra ver o preview
        </div>
      )}
    </div>
  );
}

export function PostPreview({
  canal, formato, perfil, avatarUrl, legenda, hashtags, media, titulo,
}: {
  canal: string; formato: string; perfil: string; avatarUrl?: string;
  legenda: string; hashtags: string; media?: PostMedia; titulo: string;
}) {
  const rede = REDES.find((r) => r.label === canal);
  const cor = rede?.cor || "#111";
  const ik = iconKey(canal);
  const id = redeIdOf(canal);
  const ratio = aspecto(canal, formato);
  const user = perfil || rede?.label || "perfil";
  const cap = [legenda, hashtags].filter((s) => s && s.trim()).join("  ");

  const Avatar = (
    <span style={{ width: 30, height: 30, borderRadius: 999, background: avatarUrl ? "transparent" : cor, color: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flex: "0 0 auto" }}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : ik ? <Ic name={ik} /> : (user[0] || "?").toUpperCase()}
    </span>
  );

  // YouTube: thumbnail 16:9 + título embaixo (feed do YouTube)
  if (id === "youtube") {
    return (
      <div className="pm-prev-card">
        <MediaFrame media={media} ratio={16 / 9} cor={cor} />
        <div style={{ display: "flex", gap: 10, padding: "10px 12px" }}>
          {Avatar}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 650, color: "var(--label)", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{titulo || "Título do vídeo"}</div>
            <div style={{ fontSize: 11.5, color: "var(--label-3)", marginTop: 2 }}>{user} · agora</div>
          </div>
        </div>
      </div>
    );
  }

  // padrão estilo feed (IG/LinkedIn/TikTok/etc.): header, mídia, ações, legenda
  const acoesIg = id === "instagram" || id === "facebook" || id === "threads" || id === "tiktok";
  return (
    <div className="pm-prev-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px" }}>
        {Avatar}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user}</div>
          {rede && <div style={{ fontSize: 10.5, color: "var(--label-3)" }}>{rede.label}{formato ? ` · ${formato}` : ""}</div>}
        </div>
        <span style={{ color: "var(--label-3)" }}>•••</span>
      </div>
      {/* LinkedIn/X mostram texto ANTES da mídia */}
      {(id === "linkedin" || id === "x") && cap && (
        <div style={{ padding: "0 12px 8px", fontSize: 12.5, color: "var(--label-1)", lineHeight: 1.45, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{cap}</div>
      )}
      <MediaFrame media={media} ratio={ratio} cor={cor} />
      {acoesIg && (
        <div style={{ display: "flex", gap: 16, padding: "9px 12px 4px", color: "var(--label)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 21s-7-4.5-9.5-9C1 9 2.5 5.5 6 5.5c2 0 3 1.2 3.7 2.3C10.5 6.7 11.5 5.5 13.5 5.5 17 5.5 18.5 9 18.5 12c-2.5 4.5-6.5 9-6.5 9z" /></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
        </div>
      )}
      {/* legenda embaixo (feeds visuais) */}
      {id !== "linkedin" && id !== "x" && cap && (
        <div style={{ padding: "2px 12px 12px", fontSize: 12.5, color: "var(--label-1)", lineHeight: 1.45, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          <b>{user}</b> {cap}
        </div>
      )}
    </div>
  );
}
