"use client";
// Conexões via Zernio: conectar contas de rede direto na plataforma (OAuth hospedado).
// O usuário nunca entra na Zernio. // TODO(zernio): tratar fluxos multi-step (select-page/account).
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { REDES } from "@/lib/seed-data";

// mapeia o id da rede (Casinha) → nome de plataforma da Zernio
const ZP: Record<string, string> = { x: "twitter" };
const zplat = (id: string) => ZP[id] || id;

const CONECTAVEIS = REDES.filter((r) => r.grupo === "social");

export function ConexoesZernio() {
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
    <div className="card pad-lg" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <div className="t">Conexões · redes sociais</div>
          <div className="sub">Conecte as contas do cliente direto por aqui — login na própria rede, sem entrar na Zernio. As métricas aparecem nos painéis depois.</div>
        </div>
        <button className="btn-link" onClick={refresh} type="button">Atualizar</button>
      </div>
      {erro && <div className="auth-err" style={{ marginBottom: 10 }}>{erro}</div>}
      <div className="conx-grid">
        {CONECTAVEIS.map((r) => {
          const on = connected.has(zplat(r.id));
          return (
            <div key={r.id} className={`conx-item${on ? " on" : ""}`}>
              <span className="conx-dot" style={{ background: r.cor }} />
              <span className="conx-nome">{r.label}</span>
              {on ? (
                <span className="conx-ok">conectado</span>
              ) : (
                <button className="conx-btn" onClick={() => connect(r.id)} disabled={busy === r.id} type="button">
                  {busy === r.id ? "…" : "Conectar"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
