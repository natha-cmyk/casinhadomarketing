"use client";
// Admin · Financeiro — gestão MANUAL de assinatura/faturas/indicações por workspace.
// Enquanto o Stripe não entra, a Seahub registra tudo aqui (e a conversão de indicação
// que abona a mensalidade). Só admin acessa.
import { useCallback, useEffect, useState } from "react";
import { PageHead } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { money } from "@/lib/format";

interface Sub { plano: string; valorMensal: number; valorAnualMes: number; proximaCobranca: string | null; status: string }
interface Inv { id: string; competencia: string; valor: number; status: string; vencimento: string | null }
interface Ref { id: string; cliente: string; status: string; abonouMes: string | null; createdAt: string }
interface WS { id: string; nome: string; subscription: Sub | null; invoices: Inv[]; referrals: Ref[] }

const post = (body: unknown) => fetch("/api/admin/billing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default function FinanceiroView() {
  const [rows, setRows] = useState<WS[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/admin/billing", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.ok) setRows(d.workspaces);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHead eyebrow="ADMIN · PLATAFORMA" title="Financeiro" desc="Assinaturas, faturas e indicações por cliente. Gestão manual até o Stripe entrar." />
      {loading ? <Spinner texto="Carregando…" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((w) => {
            const sub = w.subscription;
            const abonadas = w.invoices.filter((i) => i.status === "abonada").length;
            const conv = w.referrals.filter((r) => r.status === "convertido").length;
            return (
              <details key={w.id} className="card" style={{ padding: 0 }} open={open === w.id} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setOpen(w.id); }}>
                <summary style={{ listStyle: "none", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <b style={{ flex: "1 1 180px" }}>{w.nome}</b>
                  <span className="badge">{sub?.plano === "anual" ? "Anual" : "Mensal"} · {money(sub?.plano === "anual" ? (sub?.valorAnualMes ?? 420) : (sub?.valorMensal ?? 500))}/mês</span>
                  <span style={{ fontSize: 12, color: "var(--label-3)" }}>{w.invoices.length} fatura(s) · {abonadas} abonada(s)</span>
                  <span style={{ fontSize: 12, color: "var(--label-3)" }}>{w.referrals.length} indicação(ões) · {conv} convertida(s)</span>
                </summary>
                <div style={{ borderTop: "1px solid var(--hairline)", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <SubForm ws={w.id} sub={sub} onSaved={load} />
                  <StripeLinkBlock ws={w.id} />
                  <InvoicesBlock ws={w.id} invoices={w.invoices} onChange={load} />
                  <ReferralsBlock ws={w.id} referrals={w.referrals} onChange={load} />
                </div>
              </details>
            );
          })}
          {rows.length === 0 && <div className="card" style={{ padding: 20, color: "var(--label-3)", textAlign: "center" }}>Nenhum workspace ainda.</div>}
        </div>
      )}
    </>
  );
}

function SubForm({ ws, sub, onSaved }: { ws: string; sub: Sub | null; onSaved: () => void }) {
  const [plano, setPlano] = useState(sub?.plano ?? "mensal");
  const [mensal, setMensal] = useState(String(sub?.valorMensal ?? 500));
  const [anual, setAnual] = useState(String(sub?.valorAnualMes ?? 420));
  const [prox, setProx] = useState(sub?.proximaCobranca ? sub.proximaCobranca.slice(0, 10) : "");
  const salvar = async () => { await post({ type: "subscription", workspaceId: ws, plano, valorMensal: mensal, valorAnualMes: anual, proximaCobranca: prox || null }); onSaved(); };
  return (
    <div>
      <div className="field-lbl" style={{ marginBottom: 6 }}>Assinatura</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label className="field-lbl">Plano</label><select className="field-edit" value={plano} onChange={(e) => setPlano(e.target.value)}><option value="mensal">Mensal</option><option value="anual">Anual</option></select></div>
        <div><label className="field-lbl">R$/mês (mensal)</label><input className="field-edit" type="number" value={mensal} onChange={(e) => setMensal(e.target.value)} style={{ width: 110 }} /></div>
        <div><label className="field-lbl">R$/mês (anual)</label><input className="field-edit" type="number" value={anual} onChange={(e) => setAnual(e.target.value)} style={{ width: 110 }} /></div>
        <div><label className="field-lbl">Próxima cobrança</label><input className="field-edit" type="date" value={prox} onChange={(e) => setProx(e.target.value)} /></div>
        <button className="btn-link ig" type="button" onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}

function StripeLinkBlock({ ws }: { ws: string }) {
  const [plano, setPlano] = useState("mensal");
  const [trial, setTrial] = useState("0");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const gerar = async () => {
    setBusy(true); setErr(null); setUrl(null);
    const d = await fetch("/api/admin/stripe/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId: ws, plano, trialDays: Number(trial) }) }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (d?.url) setUrl(d.url); else setErr(d?.error || "Não foi possível gerar. Confira as chaves do Stripe na Vercel.");
  };
  return (
    <div>
      <div className="field-lbl" style={{ marginBottom: 6 }}>Link de pagamento (Stripe)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><label className="field-lbl">Plano</label><select className="field-edit" value={plano} onChange={(e) => setPlano(e.target.value)}><option value="mensal">Mensal</option><option value="anual_parcelado">Anual parcelado</option><option value="anual_avista">Anual à vista</option></select></div>
        <div><label className="field-lbl">Trial grátis</label><select className="field-edit" value={trial} onChange={(e) => setTrial(e.target.value)}><option value="0">Sem trial</option><option value="7">7 dias</option><option value="90">90 dias</option></select></div>
        <button className="btn-link ig" type="button" onClick={gerar} disabled={busy}>{busy ? "Gerando…" : "Gerar link"}</button>
      </div>
      {err && <div style={{ color: "var(--red)", fontSize: 12.5, marginTop: 6 }}>{err}</div>}
      {url && (
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <input className="field-edit" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ flex: 1 }} />
          <button className="btn-link" type="button" onClick={() => { navigator.clipboard?.writeText(url); }}>Copiar</button>
        </div>
      )}
    </div>
  );
}

function InvoicesBlock({ ws, invoices, onChange }: { ws: string; invoices: Inv[]; onChange: () => void }) {
  const [comp, setComp] = useState("");
  const [valor, setValor] = useState("500");
  const [status, setStatus] = useState("aberta");
  const [venc, setVenc] = useState("");
  const add = async () => { if (!comp.trim()) return; await post({ type: "invoice", workspaceId: ws, competencia: comp, valor, status, vencimento: venc || null }); setComp(""); onChange(); };
  const del = async (id: string) => { await post({ type: "delete-invoice", id }); onChange(); };
  return (
    <div>
      <div className="field-lbl" style={{ marginBottom: 6 }}>Faturas ({invoices.length})</div>
      {invoices.map((i) => (
        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--hairline)" }}>
          <span style={{ flex: 1 }}>{i.competencia} · {i.valor > 0 ? money(i.valor) : "grátis"} · {i.status} · vence {dt(i.vencimento)}</span>
          <button className="btn-link" type="button" onClick={() => del(i.id)} style={{ color: "var(--red)" }}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
        <div><label className="field-lbl">Competência</label><input className="field-edit" value={comp} onChange={(e) => setComp(e.target.value)} placeholder="Ago/2026" style={{ width: 110 }} /></div>
        <div><label className="field-lbl">Valor</label><input className="field-edit" type="number" value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 90 }} /></div>
        <div><label className="field-lbl">Status</label><select className="field-edit" value={status} onChange={(e) => setStatus(e.target.value)}><option value="aberta">Em aberto</option><option value="paga">Paga</option><option value="abonada">Abonada</option></select></div>
        <div><label className="field-lbl">Vencimento</label><input className="field-edit" type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></div>
        <button className="btn-link" type="button" onClick={add}>+ Fatura</button>
      </div>
    </div>
  );
}

function ReferralsBlock({ ws, referrals, onChange }: { ws: string; referrals: Ref[]; onChange: () => void }) {
  const [cliente, setCliente] = useState("");
  const [status, setStatus] = useState("convidado");
  const [mes, setMes] = useState("");
  const add = async () => { if (!cliente.trim()) return; await post({ type: "referral", workspaceId: ws, cliente, status, abonouMes: status === "convertido" ? mes : null }); setCliente(""); setMes(""); onChange(); };
  const del = async (id: string) => { await post({ type: "delete-referral", id }); onChange(); };
  return (
    <div>
      <div className="field-lbl" style={{ marginBottom: 6 }}>Indicações ({referrals.length})</div>
      {referrals.map((r) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", borderBottom: "1px solid var(--hairline)" }}>
          <span style={{ flex: 1 }}>{r.cliente} · {r.status}{r.abonouMes ? ` · abonou ${r.abonouMes}` : ""}</span>
          <button className="btn-link" type="button" onClick={() => del(r.id)} style={{ color: "var(--red)" }}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 8 }}>
        <div style={{ flex: "1 1 160px" }}><label className="field-lbl">Cliente indicado</label><input className="field-edit" value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
        <div><label className="field-lbl">Status</label><select className="field-edit" value={status} onChange={(e) => setStatus(e.target.value)}><option value="convidado">Convidado</option><option value="convertido">Convertido</option></select></div>
        {status === "convertido" && <div><label className="field-lbl">Mês abonado</label><input className="field-edit" value={mes} onChange={(e) => setMes(e.target.value)} placeholder="Set/2026" style={{ width: 100 }} /></div>}
        <button className="btn-link" type="button" onClick={add}>+ Indicação</button>
      </div>
    </div>
  );
}
