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

  const connected = new Set(accounts.map((a) => a.platform));

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

  async function connect(id: string) {
    setErro(null);
    setBusy(id);
    try {
      const r = await fetch(`/api/zernio/connect?platform=${encodeURIComponent(zplat(id))}`);
      const d = await r.json();
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
                const on = connected.has(zplat(r.id));
                return (
                  <div key={r.id} className={`conx-sq${on ? " on" : ""}`}>
                    <span
                      className="logo"
                      style={on ? { background: r.cor, color: "#fff" } : undefined}
                    >
                      <Logo r={r} />
                    </span>
                    <span className="conx-sq-nome">{r.label}</span>
                    {on ? (
                      <span className="conx-sq-cta on">conectado</span>
                    ) : (
                      <button
                        className="conx-sq-cta"
                        onClick={() => connect(r.id)}
                        disabled={busy === r.id}
                        type="button"
                      >
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
