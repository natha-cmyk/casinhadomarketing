"use client";
// Assinatura — dados reais (persistidos). Plano, mensalidade, próxima cobrança, meses abonados
// e histórico de faturas. Billing ainda sem provider (a cobrança automática entra depois).
// Indicações vivem em aba própria (/indicacoes).
import { useEffect, useState } from "react";
import { PageHead, KpiCard } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { money } from "@/lib/format";

interface Sub { plano: string; valorMensal: number; valorAnualMes: number; proximaCobranca: string | null; status: string; stripeSubscriptionId?: string | null; trialEnd?: string | null }
interface Inv { id: string; competencia: string; valor: number; status: "paga" | "abonada" | "aberta"; vencimento: string | null }

const PLANO_LBL: Record<string, string> = { mensal: "Mensal", anual_parcelado: "Anual (parcelado)", anual_avista: "Anual (à vista)", anual: "Anual" };
const STATUS_ASSIN: Record<string, { lbl: string; cor: string }> = {
  ativa: { lbl: "Ativa", cor: "var(--excelente)" },
  trial: { lbl: "Em teste grátis", cor: "var(--cyan)" },
  inadimplente: { lbl: "Pagamento pendente", cor: "var(--atencao)" },
  cancelada: { lbl: "Cancelada", cor: "var(--critico)" },
  pausada: { lbl: "Pausada", cor: "var(--label-3)" },
};

const STATUS_META: Record<string, { lbl: string; cor: string }> = {
  paga: { lbl: "Paga", cor: "var(--excelente)" },
  abonada: { lbl: "Abonada (indicação)", cor: "var(--cyan)" },
  aberta: { lbl: "Em aberto", cor: "var(--atencao)" },
};
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export default function AssinaturaView() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("status");
    if (q === "sucesso") setBanner("Assinatura iniciada! Pode levar alguns segundos pra confirmar o pagamento.");
    else if (q === "cancelado") setBanner("Checkout cancelado. Sua assinatura não mudou.");
  }, []);

  const assinar = async (plano: string) => {
    setBusy(plano);
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plano }) });
      const d = await r.json();
      if (d?.url) { window.location.href = d.url; return; }
      setBanner(d?.error || "Não foi possível iniciar o pagamento.");
    } catch { setBanner("Erro de rede."); }
    setBusy(null);
  };
  const gerenciar = async () => {
    setBusy("portal");
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await r.json();
      if (d?.url) { window.location.href = d.url; return; }
      setBanner(d?.error || "Sem assinatura pra gerenciar.");
    } catch { setBanner("Erro de rede."); }
    setBusy(null);
  };

  useEffect(() => {
    let alive = true;
    fetch("/api/billing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!alive) return; setSub(d?.subscription ?? null); setInvoices(Array.isArray(d?.invoices) ? d.invoices : []); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const mensal = sub?.valorMensal ?? 500;
  const anualMes = sub?.valorAnualMes ?? 420;
  const abonadas = invoices.filter((f) => f.status === "abonada").length;
  const proxima = invoices.find((f) => f.status === "aberta");

  return (
    <>
      <PageHead eyebrow="Conta" title="Assinatura" desc="Seu plano, faturas e cobranças. Indique a Casinha na aba Indicações para abonar mensalidades." />

      {loading ? <Spinner texto="Carregando assinatura…" /> : (
        <>
          {banner && (
            <div className="pm-hint" style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "color-mix(in srgb, var(--cyan) 8%, #fff)", border: "1px solid color-mix(in srgb, var(--cyan) 22%, transparent)", color: "var(--label)" }}>{banner}</div>
          )}
          <div className="grid kpis" style={{ marginBottom: 16 }}>
            <KpiCard lbl="Plano" val={PLANO_LBL[sub?.plano ?? "mensal"] ?? "Mensal"} foot={STATUS_ASSIN[sub?.status ?? ""]?.lbl ?? "Casinha"} />
            <KpiCard lbl="Mensalidade" val={money(sub?.plano === "anual_avista" ? 399 : sub?.plano === "anual_parcelado" || sub?.plano === "anual" ? anualMes : mensal)} foot="equivalente por mês" />
            <KpiCard lbl="Próxima cobrança" val={proxima ? dt(proxima.vencimento) : (sub?.proximaCobranca ? dt(sub.proximaCobranca) : "—")} foot={proxima?.competencia ?? "em dia"} />
            <KpiCard lbl="Meses abonados" val={String(abonadas)} foot="por indicação" tone="pos" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 16, alignItems: "start" }}>
            <PlanoCard nome="Mensal" preco={money(mensal)} sub="por mês · cancele quando quiser" atual={sub?.plano === "mensal"} onAssinar={() => assinar("mensal")} busy={busy === "mensal"} />
            <PlanoCard nome="Anual parcelado" preco={money(anualMes)} sub={`por mês · 12× (${money(anualMes * 12)}/ano)`} atual={sub?.plano === "anual_parcelado" || sub?.plano === "anual"} destaque onAssinar={() => assinar("anual_parcelado")} busy={busy === "anual_parcelado"} />
            <PlanoCard nome="Anual à vista" preco={money(4788)} sub="à vista/ano · 5% off · ~R$399/mês" atual={sub?.plano === "anual_avista"} onAssinar={() => assinar("anual_avista")} busy={busy === "anual_avista"} />
          </div>

          {sub?.stripeSubscriptionId && (
            <div style={{ marginBottom: 16 }}>
              <button className="btn-link" onClick={gerenciar} disabled={busy === "portal"}>{busy === "portal" ? "Abrindo…" : "Gerenciar assinatura / cartão"}</button>
            </div>
          )}

          <div className="card" style={{ padding: 0 }}>
            <div className="card-head" style={{ padding: "16px 18px 4px" }}>
              <div className="t">Faturas</div>
              <span className="badge">{invoices.length}</span>
            </div>
            {invoices.length === 0 ? (
              <div style={{ padding: "8px 18px 18px", fontSize: 13, color: "var(--label-3)" }}>Nenhuma fatura registrada ainda. Elas aparecem aqui quando o ciclo de cobrança começar.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--label-3)" }}>
                      <th style={{ padding: "8px 18px", fontWeight: 600 }}>Competência</th>
                      <th style={{ padding: "8px 18px", fontWeight: 600 }}>Vencimento</th>
                      <th style={{ padding: "8px 18px", fontWeight: 600, textAlign: "right" }}>Valor</th>
                      <th style={{ padding: "8px 18px", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((f) => {
                      const st = STATUS_META[f.status] ?? STATUS_META.aberta;
                      return (
                        <tr key={f.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                          <td style={{ padding: "10px 18px", fontWeight: 600 }}>{f.competencia}</td>
                          <td style={{ padding: "10px 18px", color: "var(--label-2)" }}>{dt(f.vencimento)}</td>
                          <td style={{ padding: "10px 18px", textAlign: "right" }} className="tnum">{f.valor > 0 ? money(f.valor) : <span style={{ color: "var(--excelente)", fontWeight: 700 }}>grátis</span>}</td>
                          <td style={{ padding: "10px 18px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: st.cor }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.cor }} />{st.lbl}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function PlanoCard({ nome, preco, sub, atual, destaque, onAssinar, busy }: { nome: string; preco: string; sub: string; atual?: boolean; destaque?: boolean; onAssinar?: () => void; busy?: boolean }) {
  return (
    <div className="card" style={{ padding: "18px 20px", border: destaque ? "1.5px solid var(--cyan)" : undefined, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <b style={{ fontSize: 15 }}>{nome}</b>
        {atual && <span className="badge" style={{ background: "var(--excelente)", color: "#fff" }}>plano atual</span>}
        {destaque && !atual && <span className="badge" style={{ background: "var(--cyan)", color: "#fff" }}>economize</span>}
      </div>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px" }}>{preco}</div>
      <div style={{ fontSize: 12.5, color: "var(--label-2)" }}>{sub}</div>
      {onAssinar && (
        <button className="btn-link ig" style={{ marginTop: 10, justifyContent: "center" }} onClick={onAssinar} disabled={busy || atual}>
          {atual ? "Plano atual" : busy ? "Abrindo…" : "Assinar"}
        </button>
      )}
    </div>
  );
}
