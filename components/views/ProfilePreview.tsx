"use client";
// Preview REAL do perfil: mostra como o perfil da rede aparece de fato (cabeçalho + grade do feed),
// a partir dos dados conectados (avatar, nome, @usuário, seguidores) e das publicações recentes.
import type { CSSProperties } from "react";
import { Ic } from "@/components/Ic";
import { ICONS } from "@/lib/nav";

interface RecentLite { thumbnail: string | null; url: string | null; isVideo?: boolean; mediaType?: string }

const ICON_BY_ID: Record<string, string> = { instagram: "ig", x: "x" };
function iconKey(platform: string): string | null {
  const k = ICON_BY_ID[platform] || platform;
  return ICONS[k] ? k : null;
}
const kfmt = (n?: number | null) => (n == null ? "—" : n >= 1000 ? (n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "k" : String(n));

export function ProfilePreview({
  platform, username, displayName, avatarUrl, followers, postsTotal, recent, cor,
}: {
  platform: string; username?: string; displayName?: string; avatarUrl?: string;
  followers?: number | null; postsTotal?: number | null; recent: RecentLite[]; cor: string;
}) {
  const ik = iconKey(platform);
  const nome = displayName || username || "perfil";
  const user = username ? "@" + username : "";
  const grid16x9 = platform === "youtube";
  const lista = platform === "linkedin" || platform === "x";
  const tiles = recent.filter((r) => r.thumbnail || r.url).slice(0, grid16x9 ? 6 : lista ? 4 : 9);

  return (
    <div className="card pad-lg tcard" style={{ "--tcard-accent": cor } as CSSProperties}>
      <div className="card-head" style={{ marginBottom: 12 }}>
        <div className="t">Como o perfil aparece</div>
        <span className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          {ik && <Ic name={ik} />}{platform}
        </span>
      </div>

      {/* cabeçalho do perfil */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ width: 72, height: 72, borderRadius: 999, overflow: "hidden", flex: "0 0 auto", background: avatarUrl ? "transparent" : cor, display: "grid", placeItems: "center", color: "#fff", boxShadow: "var(--shadow-card)" }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : ik ? <Ic name={ik} /> : (nome[0] || "?").toUpperCase()}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 750, color: "var(--label)", lineHeight: 1.2 }}>{nome}</div>
          {user && <div style={{ fontSize: 13, color: "var(--label-3)" }}>{user}</div>}
          <div style={{ display: "flex", gap: 18, marginTop: 8 }}>
            <div><b className="tnum" style={{ fontSize: 15 }}>{kfmt(postsTotal)}</b> <span style={{ fontSize: 12, color: "var(--label-3)" }}>posts</span></div>
            <div><b className="tnum" style={{ fontSize: 15 }}>{kfmt(followers)}</b> <span style={{ fontSize: 12, color: "var(--label-3)" }}>seguidores</span></div>
          </div>
        </div>
      </div>

      {/* feed */}
      <div style={{ marginTop: 16 }}>
        {tiles.length === 0 ? (
          <div style={{ fontSize: 12.5, color: "var(--label-3)" }}>Sem publicações recentes pra montar o feed.</div>
        ) : lista ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {tiles.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", flex: "0 0 auto", background: "#0d0d0f", display: "grid", placeItems: "center" }}>
                  {r.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : <span style={{ color: "#fff", opacity: .5, fontSize: 18 }}>▤</span>}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--label-2)" }}>Publicação recente</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: grid16x9 ? "1fr 1fr" : "1fr 1fr 1fr", gap: 4 }}>
            {tiles.map((r, i) => (
              <div key={i} style={{ position: "relative", aspectRatio: grid16x9 ? "16/9" : "1", background: "#0d0d0f", overflow: "hidden", borderRadius: grid16x9 ? 8 : 2 }}>
                {r.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", opacity: .4 }}>▤</span>}
                {r.isVideo && <span style={{ position: "absolute", top: 4, right: 5, color: "#fff", fontSize: 11, textShadow: "0 1px 3px rgba(0,0,0,.6)" }}>▶</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: "var(--label-3)", marginTop: 10 }}>Prévia montada com o avatar, os números e as publicações reais da conta conectada.</div>
    </div>
  );
}
