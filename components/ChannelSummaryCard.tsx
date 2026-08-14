"use client";
// Card de resumo POR CANAL no Painel (overview). Estrutura o mesmo olhar analítico
// do painel de conta (indicadores primários em destaque, agrupados), com acento na
// cor da rede. Um SELO com o nome da rede identifica o canal de cara (a logo sozinha
// não basta). Estilos inline (não depende de classes novas em globals.css).
import Link from "next/link";
import type { CSSProperties } from "react";
import { Ic } from "@/components/Ic";
import { fmt, kfmt } from "@/lib/format";
import { REDES } from "@/lib/seed-data";

// plataforma da integração → id da rede (Casinha)
const REDE_ID: Record<string, string> = { twitter: "x" };
const redeId = (platform: string) => REDE_ID[platform] || platform;

// id da rede → nome legível (selo). Cai no id se a rede não estiver no catálogo.
const REDE_LABEL: Record<string, string> = Object.fromEntries(REDES.map((r) => [r.id, r.label]));
const redeLabel = (id: string) => REDE_LABEL[id] || id;

// id da rede → nome do ícone em lib/nav (ICONS).
// ATENÇÃO: o glifo do Instagram em ICONS chama-se "ig" (não "instagram").
const ICON_OF: Record<string, string> = {
  instagram: "ig", facebook: "facebook", tiktok: "tiktok", youtube: "youtube",
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

// chaves de impressões do Google Business (busca + Maps, mobile + desktop)
const GBP_IMPRESSION_KEYS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
];
// componentes de interação do LinkedIn agregado (não há um total pronto)
const LINKEDIN_INTERACTION_KEYS = ["reactions", "comments", "shares", "saves", "sends"];

// indicadores PRIMÁRIOS por plataforma (o mesmo recorte dos KPIs-herói do painel de canal)
function primaryIndicators(
  platform: string,
  followersCount: number | null,
  m: Record<string, number>
): Ind[] {
  const g = (k: string) => (m[k] != null && Number.isFinite(m[k]) ? m[k] : null);
  const F = (n: number | null) => (n != null ? fmt(n) : "—"); // contagem exata (tabular)
  const K = (n: number | null) => (n != null ? kfmt(n) : "—"); // compacto (k) p/ volumes
  // soma de várias chaves; retorna null se NENHUMA existir (distingue "sem dado" de zero real)
  const sumKeys = (keys: string[]) => {
    const present = keys.filter((k) => g(k) != null);
    return present.length ? present.reduce((s, k) => s + (g(k) as number), 0) : null;
  };
  const signed = (n: number | null) =>
    n == null ? "—" : (n > 0 ? "+" : "") + fmt(n);

  if (platform === "youtube") {
    const watch = g("estimatedMinutesWatched") ?? g("watch_time");
    const gained = g("subscribersGained");
    const lost = g("subscribersLost");
    const net = gained != null || lost != null ? (gained ?? 0) - (lost ?? 0) : null;
    return [
      { label: "Inscritos", value: F(followersCount) },
      { label: "Visualizações", value: K(g("views")), hint: "no período" },
      { label: "Tempo de exibição", value: watch != null ? `${kfmt(watch)} min` : "—", hint: "estimado" },
      { label: "Inscritos líquidos", value: signed(net), hint: "ganhos − perdidos" },
    ];
  }
  if (platform === "tiktok") {
    return [
      { label: "Seguidores", value: F(followersCount ?? g("follower_count")) },
      { label: "Curtidas totais", value: K(g("likes_count")), hint: "acumulado" },
      { label: "Vídeos", value: F(g("video_count")), hint: "publicados" },
      { label: "Visualizações", value: K(g("views")), hint: "no período" },
    ];
  }
  if (platform === "linkedin") {
    const inter = sumKeys(LINKEDIN_INTERACTION_KEYS);
    return [
      { label: "Seguidores", value: F(followersCount) },
      { label: "Impressões", value: K(g("impressions")), hint: "no período" },
      { label: "Alcance", value: K(g("reach")), hint: "no período" },
      { label: "Interações", value: K(inter), hint: "engajamento bruto" },
    ];
  }
  if (platform === "googlebusiness") {
    // GBP NÃO tem "seguidores" — o recorte é descoberta e ações locais.
    return [
      { label: "Impressões", value: K(sumKeys(GBP_IMPRESSION_KEYS)), hint: "busca + Maps" },
      { label: "Pedidos de rota", value: F(g("BUSINESS_DIRECTION_REQUESTS")), hint: "no período" },
      { label: "Cliques no site", value: F(g("WEBSITE_CLICKS")), hint: "no período" },
      { label: "Cliques p/ ligar", value: F(g("CALL_CLICKS")), hint: "no período" },
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
  // threads / demais → apenas a base de seguidores
  return [{ label: "Seguidores", value: F(followersCount), hint: "base atual" }];
}

export function ChannelSummaryCard({
  platform,
  displayName,
  username,
  followersCount,
  metrics,
  posts,
  cor,
  periodLabel,
}: {
  platform: string;
  displayName?: string;
  username?: string;
  followersCount: number | null;
  metrics: Record<string, number>;
  posts?: number | null;
  cor: string;
  periodLabel?: string;
}) {
  const id = redeId(platform);
  const label = redeLabel(id);
  // descarta indicadores sem dado ("—"); garante ao menos um p/ o card não ficar vazio
  const built = primaryIndicators(platform, followersCount, metrics);
  const shown = built.filter((i) => i.value !== "—");
  const inds = shown.length ? shown : built.slice(0, 1);
  const icon = ICON_OF[id];

  // identidade da conta: @handle quando parece handle (sem espaços); senão o nome da ficha
  const looksHandle = username && !/\s/.test(username);
  const handle = looksHandle ? `@${username!.replace(/^@/, "")}` : null;
  const identity = handle || displayName || username || label;

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
      {/* cabeçalho: ícone + selo da rede + identidade da conta + abrir painel */}
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
          {/* SELO com o nome da rede — identificação inequívoca do canal */}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 20,
              padding: "0 8px",
              borderRadius: 999,
              background: `color-mix(in srgb, ${cor} 13%, #fff)`,
              color: cor,
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".1px",
              lineHeight: 1,
              whiteSpace: "nowrap",
              maxWidth: "100%",
            }}
          >
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: cor, flex: "0 0 6px" }} />
            {label}
          </span>
          <div
            title={identity}
            style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-.1px", color: "var(--label-2)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {identity}
          </div>
        </div>
        <Link
          href={panelHref(platform)}
          className="btn-link"
          style={{ padding: "6px 11px", fontSize: 12.5, flex: "0 0 auto" }}
          aria-label={`Abrir painel de ${label}`}
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

      {/* período dos indicadores — reforço explícito de que os números são da janela selecionada */}
      {periodLabel && (
        <div style={{ fontSize: 11, color: "var(--label-3)", fontWeight: 500, marginTop: -4 }}>
          Indicadores no período: <span style={{ color: "var(--label-2)", fontWeight: 600 }}>{periodLabel}</span>
        </div>
      )}

      {/* rodapé: produção de conteúdo no período (só redes com posting) */}
      {posts != null && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingTop: 12,
            borderTop: "1px solid var(--hairline)",
            fontSize: 12,
            color: "var(--label-3)",
          }}
        >
          <span className="tnum" style={{ fontWeight: 700, color: "var(--label)", fontSize: 13 }}>{fmt(posts)}</span>
          {posts === 1 ? "post publicado no período" : "posts publicados no período"}
        </div>
      )}
    </div>
  );
}
