"use client";
// Planejador de grade de feed: mostra como o NOVO post encaixa na grade real do perfil
// (posts já publicados), com o novo conteúdo na 1ª posição (mais recente).
import type { PostMedia } from "@/lib/store";

interface RecentLite { thumbnail: string | null; url: string | null; isVideo?: boolean }

export function FeedGridPreview({ newMedia, recent, loading, cor }: {
  newMedia?: PostMedia; recent: RecentLite[]; loading: boolean; cor: string;
}) {
  const antigos = recent.filter((r) => r.thumbnail || r.url).slice(0, 11);
  const novoUrl = newMedia?.url || null;
  const novoVideo = newMedia?.type === "video";

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3, borderRadius: 10, overflow: "hidden" }}>
        {/* NOVO post — 1ª célula */}
        <div style={{ position: "relative", aspectRatio: "1", background: "#0d0d0f", overflow: "hidden" }}>
          {novoUrl ? (
            novoVideo ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={novoUrl} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={novoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )
          ) : (
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: cor, color: "#fff", fontSize: 10.5, fontWeight: 700, textAlign: "center", padding: 6 }}>
              anexe a mídia
            </div>
          )}
          <span style={{ position: "absolute", top: 4, left: 4, background: cor, color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 999 }}>NOVO</span>
        </div>
        {/* posts já publicados */}
        {antigos.map((r, i) => (
          <div key={i} style={{ position: "relative", aspectRatio: "1", background: "#0d0d0f", overflow: "hidden" }}>
            {r.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", opacity: .35 }}>▤</span>
            )}
            {r.isVideo && <span style={{ position: "absolute", top: 4, right: 5, color: "#fff", fontSize: 10, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>▶</span>}
          </div>
        ))}
        {/* preenche o resto da grade com placeholders quando há poucos posts */}
        {!loading && antigos.length < 8 && Array.from({ length: 8 - antigos.length }).map((_, i) => (
          <div key={`ph${i}`} style={{ aspectRatio: "1", background: "var(--cream)" }} />
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--label-3)", marginTop: 8 }}>
        {loading ? "Carregando o feed do perfil…" : "O novo post entra no topo da grade. Assim você vê como fica organizado no feed."}
      </div>
    </div>
  );
}
