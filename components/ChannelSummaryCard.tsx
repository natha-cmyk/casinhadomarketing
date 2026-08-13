"use client";
// Card de resumo POR CANAL no Painel (overview). Estrutura o mesmo olhar analítico
// do painel de conta (indicadores primários em destaque, agrupados), com acento na
// cor da rede. Estilos inline (não depende de classes novas em globals.css).
import Link from "next/link";
import type { CSSProperties } from "react";
import { Ic } from "@/components/Ic";
import { fmt, kfmt } from "@/lib/format";

// plataforma da integração → id da rede (Casinha)
const REDE_ID: Record<string, string> = { twitter: "x" };
const redeId = (platform: string) => REDE_ID[platform] || platform;

// id da rede → nome do ícone em lib/nav (ICONS)
const ICON_OF: Record<string, string> = {
  instagram: "instagram", facebook: "facebook", tiktok: "tiktok", youtube: "youtube",
  linkedin: "linkedin", x: "x", threads: "threads", googlebusiness: "googlebusiness",
  pinterest: "pinterest", reddit: "reddit", snapchat: "snapchat", bluesky: "bluesky",
};

// destino do "abrir painel" — Instagram tem rota própria; demais em /canal/<rede>
function panelHref(platform: string) {
  const id = redeId(platform);
  return id === "instagram" ? "/instagram" : `/canal/${id}`;
}

interface Ind { label: string; value: string; hint?: string }

const pctFmt = (frac: number) =>
  (frac * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

// indicadores PRIMÁRIOS por plataforma (o mesmo recorte dos KPIs-herói do painel de canal)
function primaryIndicators(
  platform: string,
  followersCount: number | null,
  m: Record<string, number>
): Ind[] {
  const g = (k: string) => (m[k] != null && Number.isFinite(m[k]) ? m[k] : null);
  const F = (n: number | null) => (n != null ? fmt(n) : "—"); // contagem exata (tabular)
  const K = (n: number | null) => (n != null ? kfmt(n) : "—"); // compacto (k) p/ volumes

  if (platform === "youtube") {
    const watch = g("estimatedMinutesWatched") ?? g("watch_time");
    return [
      { label: "Inscritos", value: F(followersCount) },
      { label: "Visualizações", value: K(g("views")), hint: "no período" },
      { label: "Tempo de exibição", value: watch != null ? `${kfmt(watch)} min` : "—", hint: "estimado" },
    ];
  }
  if (platform === "tiktok") {
    return [
      { label: "Seguidores", value: F(followersCount ?? g("follower_count")) },
      { label: "Curtidas totais", value: K(g("likes_count")), hint: "acumulado" },
      { label: "Vídeos", value: F(g("video_count")), hint: "publicados" },
    ];
  }
  if (platform === "linkedin") {
    return [
      { label: "Seguidores", value: F(followersCount) },
      { label: "Impressões", value: K(g("impressions")), hint: "no período" },
      { label: "Alcance", value: K(g("reach")), hint: "no período" },
    ];
  }
  if (platform === "twitter") {
    return [
      { label: "Seguidores", value: F(followersCount) },
      { label: "Impressões", value: K(g("impressions")), hint: "no período" },
      { label: "Interações", value: K(g("engagements")), hint: "no período" },
    ];
  }
  if (platform === "instagram" || platform === "facebook") {
    const reach = g("reach");
    const inter = g("total_interactions");
    const eng = inter != null && reach ? inter / reach : null;
    return [
      { label: "Seguidores", value: F(followersCount) },
      { label: "Alcance", value: K(reach), hint: "no período" },
      { label: "Interações", value: K(inter), hint: "engajamento bruto" },
      { label: "Engajamento", value: eng != null ? pctFmt(eng) : "—", hint: "interações ÷ alcance" },
    ];
  }
  // threads / googlebusiness / demais → apenas a base de seguidores
  return [{ label: "Seguidores", value: F(followersCount), hint: "base atual" }];
}

export function ChannelSummaryCard({
  platform,
  displayName,
  username,
  followersCount,
  metrics,
  cor,
}: {
  platform: string;
  displayName?: string;
  username?: string;
  followersCount: number | null;
  metrics: Record<string, number>;
  cor: string;
}) {
  const id = redeId(platform);
  const inds = primaryIndicators(platform, followersCount, metrics);
  const icon = ICON_OF[id];
  const nome = displayName || username || id;
  const handle = username ? `@${username.replace(/^@/, "")}` : null;

  return (
    <div
      className="card"
      style={{
        borderLeft: `3px solid ${cor}`,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "18px 20px",
      }}
    >
      {/* cabeçalho: ícone da rede + nome/@ + abrir painel */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          aria-hidden
          style={{
            width: 34,
            height: 34,
            flex: "0 0 34px",
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: `color-mix(in srgb, ${cor} 12%, #fff)`,
            color: cor,
          }}
        >
          {icon ? <Ic name={icon} /> : <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor }} />}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{ fontSize: 14.5, fontWeight: 640, letterSpacing: "-.1px", color: "var(--label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {nome}
          </div>
          <div style={{ fontSize: 12, color: "var(--label-3)", marginTop: 1 }}>
            {handle || id}
          </div>
        </div>
        <Link
          href={panelHref(platform)}
          className="btn-link"
          style={{ padding: "6px 11px", fontSize: 12.5 }}
          aria-label={`Abrir painel de ${nome}`}
        >
          Abrir painel <span aria-hidden>↗</span>
        </Link>
      </div>

      {/* indicadores primários — grandes, tabular-nums */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: inds.length >= 3 ? "repeat(2,1fr)" : "1fr",
          gap: 12,
        }}
      >
        {inds.map((ind) => (
          <div key={ind.label}>
            <div className="tnum" style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1, color: "var(--label)" } as CSSProperties}>
              {ind.value}
            </div>
            <div style={{ fontSize: 12, color: "var(--label-2)", fontWeight: 500, marginTop: 5 }}>{ind.label}</div>
            {ind.hint && <div style={{ fontSize: 11, color: "var(--label-3)", marginTop: 2 }}>{ind.hint}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
