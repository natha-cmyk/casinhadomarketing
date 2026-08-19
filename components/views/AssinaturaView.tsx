"use client";
// Assinatura — dados reais (persistidos). Plano, mensalidade, próxima cobrança, meses abonados
// e histórico de faturas. Billing ainda sem provider (a cobrança automática entra depois).
// Indicações vivem em aba própria (/indicacoes).
import { useEffect, useState } from "react";
import { PageHead, KpiCard } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { money } from "@/lib/format";

interface Sub { plano: string; valorMensal: number; valorAnualMes: number; proximaCobranca: string | null; status: string }
interface Inv { id: string; competencia: string; valor: number; status: "paga" | "abonada" | "aberta"; vencimento: string | null }

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
          <div className="grid kpis" style={{ marginBottom: 16 }}>
            <KpiCard lbl="Plano" val={sub?.plano === "anual" ? "Anual" : "Mensal"} foot="Casinha" />
            <KpiCard lbl="Mensalidade" val={money(sub?.plano === "anual" ? anualMes : mensal)} foot={sub?.plano === "anual" ? "no plano anual" : `anual sai ${money(anualMes)}/mês`} />
            <KpiCard lbl="Próxima cobrança" val={proxima ? dt(proxima.vencimento) : (sub?.proximaCobranca ? dt(sub.proximaCobranca) : "—")} foot={proxima?.competencia ?? "em dia"} />
            <KpiCard lbl="Meses abonados" val={String(abonadas)} foot="por indicação" tone="pos" />
          </div>

          <div className="grid two-col" style={{ marginBottom: 16, alignItems: "start" }}>
            <PlanoCard nome="Mensal" preco={money(mensal)} sub="por mês · cancele quando quiser" atual={sub?.plano !== "anual"} />
            <PlanoCard nome="Anual" preco={money(anualMes)} sub={`por mês · ${money(anualMes * 12)}/ano · economize ${money((mensal - anualMes) * 12)}`} atual={sub?.plano === "anual"} destaque />
          </div>

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

function PlanoCard({ nome, preco, sub, atual, destaque }: { nome: string; preco: string; sub: string; atual?: boolean; destaque?: boolean }) {
  return (
    <div className="card" style={{ padding: "18px 20px", border: destaque ? "1.5px solid var(--cyan)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 15 }}>{nome}</b>
        {atual && <span className="badge" style={{ background: "var(--excelente)", color: "#fff" }}>plano atual</span>}
        {destaque && !atual && <span className="badge" style={{ background: "var(--cyan)", color: "#fff" }}>economize</span>}
      </div>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px" }}>{preco}</div>
      <div style={{ fontSize: 12.5, color: "var(--label-2)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
