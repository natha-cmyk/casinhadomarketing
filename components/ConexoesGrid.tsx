"use client";
// Grid de conexões (quadrados) reaproveitável por grupo de rede.
// Preserva a lógica de connect do ConexoesZernio: OAuth hospedado, popup + poll + message listener.
// O usuário nunca entra na Zernio. // TODO(zernio): tratar fluxos multi-step (select-page/account).
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { REDES, type Rede } from "@/lib/seed-data";
import { ICONS } from "@/lib/nav";
import { Ic } from "@/components/Ic";

// mapeia o id da rede (Casinha) → nome de plataforma da Zernio
const ZP: Record<string, string> = { x: "twitter" };
const zplat = (id: string) => ZP[id] || id;

// ads: id da rede → plataforma aceita por /connect/{platform}/ads (X Ads/OpenAI Ads ficam de fora)
const AD_CONNECT: Record<string, string> = {
  metaads: "facebook",
  googleads: "googleads",
  linkedinads: "linkedin",
  tiktokads: "tiktok",
  pinterestads: "pinterest",
  xads: "twitter",
};

// mapeia o id da rede → nome do glifo em ICONS (lib/nav)
const ICON_FOR: Record<string, string> = {
  instagram: "ig",
  metaads: "facebook",
  linkedinads: "linkedin",
  tiktokads: "tiktok",
  pinterestads: "pinterest",
  xads: "x",
  googleads: "ads",
  openaiads: "ads",
};
const icoName = (id: string) => ICON_FOR[id] || id;

const GROUP_LABEL: Record<Rede["grupo"], string> = {
  social: "Social",
  conversas: "Conversas",
  ads: "Ads",
};

function Logo({ r }: { r: Rede }) {
  const name = icoName(r.id);
  if (ICONS[name]) return <Ic name={name} />;
  // fallback: inicial da rede quando não há glifo mapeado
  return <span className="conx-sq-ini">{(r.label || "?")[0]}</span>;
}

export function ConexoesGrid({ grupos }: { grupos: Rede["grupo"][] }) {
  const accounts = useStore((s) => s.zernioAccounts);
  const setZernioAccounts = useStore((s) => s.setZernioAccounts);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // social conectado = conta da plataforma com posting habilitado (enabled).
  // contas ads-only (ex. Facebook que veio junto do Meta Ads, enabled:false) NÃO contam.
  // Contagem por plataforma: pode haver 2+ contas da mesma rede (multi-conta).
  const socialCount = new Map<string, number>();
  for (const a of accounts) if (a.enabled === true) socialCount.set(a.platform, (socialCount.get(a.platform) || 0) + 1);
  const socialConnected = new Set(socialCount.keys());
  // ads conectado = existe conta DEDICADA de anúncio (platform = id do quadrado, ex. "metaads").
  // não usa o token social (LinkedIn/Facebook social herdam adsStatus mas não são ads).
  const isGoogleAds = (p?: string) => { const t = String(p || "").toLowerCase(); return t.includes("google") && t.includes("ads"); };
  const adsConnected = new Set(
    accounts.filter((a) => a.adsStatus === "connected" || a.adsStatus === "active").map((a) => a.platform)
  );
  // Google Ads é conta standalone (sem adsStatus) — marca o quadrado "googleads" conectado se existir.
  if (accounts.some((a) => isGoogleAds(a.platform))) adsConnected.add("googleads");

  // contas-alvo de um quadrado (pra desconectar). Social: contas da plataforma com posting.
  // Ads: conta dedicada de anúncio (google standalone, ou a plataforma base do Meta com adsStatus).
  function acctsFor(r: Rede) {
    if (r.grupo === "ads") {
      if (r.id === "googleads") return accounts.filter((a) => isGoogleAds(a.platform));
      const plat = AD_CONNECT[r.id];
      return accounts.filter((a) => a.platform === plat && (a.adsStatus === "connected" || a.adsStatus === "active"));
    }
    return accounts.filter((a) => a.platform === zplat(r.id) && a.enabled === true);
  }

  async function disconnect(r: Rede) {
    const ids = acctsFor(r).map((a) => a._id);
    if (!ids.length) return;
    if (!window.confirm(`Desconectar ${r.label}? Você vai precisar reconectar depois pra voltar a puxar os dados.`)) return;
    setErro(null);
    setBusy(r.id);
    try {
      for (const id of ids) {
        await fetch("/api/zernio/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId: id }) });
      }
      await refresh();
    } catch (e) {
      setErro(String(e));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data === "zernio-connected") refresh();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    try {
      const r = await fetch("/api/zernio/accounts");
      const d = await r.json();
      if (d?.accounts) setZernioAccounts(d.accounts);
    } catch {}
  }

  async function connect(id: string, ads = false) {
    setErro(null);
    setBusy(id);
    try {
      const plat = ads ? AD_CONNECT[id] : zplat(id);
      const r = await fetch(`/api/zernio/connect?platform=${encodeURIComponent(plat)}${ads ? "&ads=1" : ""}`);
      const d = await r.json();
      if (d.alreadyConnected) {
        setBusy(null);
        refresh();
        return;
      }
      if (!d.authUrl) {
        setErro(d.error || "Não foi possível iniciar a conexão.");
        setBusy(null);
        return;
      }
      const w = window.open(d.authUrl, "zernio-connect", "width=620,height=780");
      const timer = setInterval(() => {
        if (!w || w.closed) {
          clearInterval(timer);
          setBusy(null);
          refresh();
        }
      }, 1000);
    } catch (e) {
      setErro(String(e));
      setBusy(null);
    }
  }

  return (
    <>
      {erro && <div className="auth-err" style={{ marginBottom: 10 }}>{erro}</div>}
      {grupos.map((g) => {
        const redes = REDES.filter((r) => r.grupo === g);
        if (redes.length === 0) return null;
        return (
          <div key={g} className="conx-block">
            <div className="conx-block-h">{GROUP_LABEL[g]}</div>
            <div className="conx-grid2">
              {redes.map((r) => {
                // ads: conta dedicada de anúncio (platform = id do quadrado, ex. "metaads");
                // social: conta com posting habilitado. Sem cruzar um com o outro.
                const isSocial = r.grupo !== "ads";
                const nContas = isSocial ? socialCount.get(zplat(r.id)) || 0 : 0;
                const on = r.grupo === "ads" ? adsConnected.has(r.id) : socialConnected.has(zplat(r.id));
                return (
                  <div key={r.id} className={`conx-sq${on ? " on" : ""}`}>
                    <span
                      className="logo"
                      style={on ? { background: r.cor, color: "#fff" } : undefined}
                    >
                      <Logo r={r} />
                    </span>
                    <span className="conx-sq-nome">{r.label}</span>
                    {on && isSocial ? (
                      // conta social conectada: mostra contagem e permite adicionar OUTRA
                      // conta da mesma rede (o OAuth da Zernio adiciona ao profile).
                      <div className="conx-sq-conn">
                        <span className="conx-sq-cta on">conectado{nContas > 1 ? ` · ${nContas}` : ""}</span>
                        <button
                          className="conx-sq-add"
                          onClick={() => connect(r.id)}
                          disabled={busy === r.id}
                          type="button"
                          title="Conectar outra conta desta rede"
                        >
                          {busy === r.id ? "…" : "+ conta"}
                        </button>
                        <button className="conx-sq-off" onClick={() => disconnect(r)} disabled={busy === r.id} type="button" title="Desconectar esta rede">
                          desconectar
                        </button>
                      </div>
                    ) : on ? (
                      <div className="conx-sq-conn">
                        <span className="conx-sq-cta on">conectado</span>
                        <button className="conx-sq-off" onClick={() => disconnect(r)} disabled={busy === r.id} type="button" title="Desconectar">
                          {busy === r.id ? "…" : "desconectar"}
                        </button>
                      </div>
                    ) : r.grupo === "ads" && !AD_CONNECT[r.id] ? (
                      <span className="conx-sq-cta" style={{ opacity: 0.55, cursor: "default", color: "var(--label-3)" }} title="Conexão via API não suportada por esta plataforma">
                        em breve
                      </span>
                    ) : (
                      <button className="conx-sq-cta" onClick={() => connect(r.id, r.grupo === "ads")} disabled={busy === r.id} type="button">
                        {busy === r.id ? "…" : "Conectar"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
