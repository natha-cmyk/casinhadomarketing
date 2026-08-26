"use client";
// Admin · Links de cadastro personalizados — gera um link (plano + trial) pra mandar pro
// cliente; quando ele conclui o cadastro, a assinatura já abre EM TRIAL (sem cobrar agora).
import { useCallback, useEffect, useState } from "react";
import { PageHead } from "@/components/ui";
import { Spinner } from "@/components/Spinner";

interface Item { id: string; token: string; nomeAcao: string; plano: string; planoLabel: string; trialDays: number; url: string; usadoPorEmail: string | null; usadoEm: string | null; createdAt: string }

const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default function CadastroLinksView() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [nomeAcao, setNomeAcao] = useState("");
  const [plano, setPlano] = useState("mensal");
  const [trial, setTrial] = useState("7");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/signup-links", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.ok) setItems(d.items);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const gerar = async () => {
    setBusy(true);
    await fetch("/api/admin/signup-links", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nomeAcao, plano, trialDays: Number(trial) }) }).catch(() => {});
    setBusy(false);
    setNomeAcao("");
    load();
  };
  const apagar = async (id: string) => { await fetch(`/api/admin/signup-links?id=${id}`, { method: "DELETE" }).catch(() => {}); load(); };

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Links de cadastro" desc="Gere um link personalizado com plano + trial. Quando o cliente conclui o cadastro por ele, a assinatura já abre em teste grátis (a cobrança começa quando o trial acaba)." />

      <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
        <div className="field-lbl" style={{ marginBottom: 8 }}>Gerar novo link</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 200px" }}><label className="field-lbl">Nome da ação (campanha)</label><input className="field-edit" value={nomeAcao} onChange={(e) => setNomeAcao(e.target.value)} placeholder="Ex.: Feira SEBRAE ago/26" /></div>
          <div><label className="field-lbl">Plano</label><select className="field-edit" value={plano} onChange={(e) => setPlano(e.target.value)}><option value="mensal">Mensal (R$500)</option><option value="anual_parcelado">Anual parcelado (R$420/mês)</option><option value="anual_avista">Anual à vista (R$4.788)</option></select></div>
          <div><label className="field-lbl">Trial grátis</label><select className="field-edit" value={trial} onChange={(e) => setTrial(e.target.value)}><option value="0">Sem trial</option><option value="7">7 dias</option><option value="90">90 dias</option></select></div>
          <button className="btn-link ig" type="button" onClick={gerar} disabled={busy}>{busy ? "Gerando…" : "Gerar link"}</button>
        </div>
        {trial === "0" && <div className="pm-hint" style={{ marginTop: 8 }}>Sem trial: o cliente cadastra e assina/paga normalmente na aba Assinatura (não abre assinatura automática).</div>}
      </div>

      {loading ? <Spinner texto="Carregando…" /> : (
        <div className="card" style={{ padding: 0 }}>
          <div className="card-head" style={{ padding: "16px 18px 4px" }}><div className="t">Links gerados</div><span className="badge">{items.length}</span></div>
          {items.length === 0 ? (
            <div style={{ padding: "8px 18px 18px", fontSize: 13, color: "var(--label-3)" }}>Nenhum link ainda. Gere um acima.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((it) => (
                <div key={it.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--hairline)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{it.nomeAcao ? <span style={{ display: "inline-block", background: "var(--cyan)", color: "#fff", borderRadius: 999, padding: "1px 9px", fontSize: 11, marginRight: 6 }}>{it.nomeAcao}</span> : null}{it.planoLabel} · {it.trialDays > 0 ? `trial ${it.trialDays} dias` : "sem trial"}</div>
                    <input className="field-edit" readOnly value={it.url} onFocus={(e) => e.currentTarget.select()} style={{ fontSize: 12, marginTop: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--label-3)", flex: "0 0 auto" }}>
                    {it.usadoEm ? <span style={{ color: "var(--excelente)" }}>usado por {it.usadoPorEmail} · {dt(it.usadoEm)}</span> : <span>não usado · criado {dt(it.createdAt)}</span>}
                  </div>
                  <button className="btn-link" type="button" onClick={() => { navigator.clipboard?.writeText(it.url); }}>Copiar</button>
                  <button className="btn-link" type="button" onClick={() => apagar(it.id)} style={{ color: "var(--red)" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
