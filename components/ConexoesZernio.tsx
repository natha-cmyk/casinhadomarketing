"use client";
// Conexões via Zernio: conectar contas de rede direto na plataforma (OAuth hospedado).
// O usuário nunca entra na Zernio. A lógica de connect vive em ConexoesGrid.
import { useStore } from "@/lib/store";
import { ConexoesGrid } from "@/components/ConexoesGrid";

export function ConexoesZernio() {
  const setZernioAccounts = useStore((s) => s.setZernioAccounts);

  async function refresh() {
    try {
      const r = await fetch("/api/zernio/accounts");
      const d = await r.json();
      if (d?.accounts) setZernioAccounts(d.accounts);
    } catch {}
  }

  return (
    <div className="card pad-lg" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div>
          <div className="t">Conexões</div>
          <div className="sub">Conecte as contas do cliente direto por aqui — login seguro direto na própria rede. As métricas aparecem nos painéis depois.</div>
        </div>
        <button className="btn-link" onClick={refresh} type="button">Atualizar</button>
      </div>
      <ConexoesGrid grupos={["social", "conversas", "ads"]} />
    </div>
  );
}
