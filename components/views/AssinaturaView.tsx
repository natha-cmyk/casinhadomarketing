"use client";
// Assinatura — MOCKUP (billing ainda sem provider). Plano, mensalidade, próxima cobrança,
// meses abonados e histórico de faturas. Indicações vivem em aba própria (/indicacoes).
// TODO(billing): ligar num provider real (ciclo/próxima cobrança/faturas).
import { PageHead, KpiCard } from "@/components/ui";
import { money } from "@/lib/format";

// planos (valores oficiais)
const PLANO_MENSAL = 500; // R$/mês no plano mensal
const PLANO_ANUAL_MES = 420; // R$/mês equivalente no plano anual

// faturas MOCK (estrutura pronta pro provider real)
type Fatura = { id: string; competencia: string; valor: number; status: "paga" | "abonada" | "aberta"; venc: string };
const FATURAS_MOCK: Fatura[] = [
  { id: "f6", competencia: "Ago/2026", valor: PLANO_MENSAL, status: "aberta", venc: "10/09/2026" },
  { id: "f5", competencia: "Jul/2026", valor: 0, status: "abonada", venc: "10/08/2026" },
  { id: "f4", competencia: "Jun/2026", valor: PLANO_MENSAL, status: "paga", venc: "10/07/2026" },
  { id: "f3", competencia: "Mai/2026", valor: PLANO_MENSAL, status: "paga", venc: "10/06/2026" },
  { id: "f2", competencia: "Abr/2026", valor: 0, status: "abonada", venc: "10/05/2026" },
  { id: "f1", competencia: "Mar/2026", valor: PLANO_MENSAL, status: "paga", venc: "10/04/2026" },
];

const STATUS_META: Record<Fatura["status"], { lbl: string; cor: string }> = {
  paga: { lbl: "Paga", cor: "var(--excelente)" },
  abonada: { lbl: "Abonada (indicação)", cor: "var(--cyan)" },
  aberta: { lbl: "Em aberto", cor: "var(--atencao)" },
};

export default function AssinaturaView() {
  const abonadas = FATURAS_MOCK.filter((f) => f.status === "abonada").length;
  const proxima = FATURAS_MOCK.find((f) => f.status === "aberta");

  return (
    <>
      <PageHead
        eyebrow="Conta"
        title="Assinatura"
        desc="Seu plano, faturas e cobranças. Indique a Casinha na aba Indicações para abonar mensalidades."
      />

      <div className="insight" style={{ marginBottom: 16 }}>
        <p><b>Prévia.</b> Os valores de fatura abaixo são exemplos — a cobrança real entra quando ligarmos o meio de pagamento.</p>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Plano" val="Mensal" foot="Casinha" />
        <KpiCard lbl="Mensalidade" val={money(PLANO_MENSAL)} foot={`anual sai ${money(PLANO_ANUAL_MES)}/mês`} />
        <KpiCard lbl="Próxima cobrança" val={proxima ? proxima.venc : "—"} foot={proxima ? proxima.competencia : "em dia"} />
        <KpiCard lbl="Meses abonados" val={String(abonadas)} foot="por indicação" tone="pos" />
      </div>

      {/* opções de plano */}
      <div className="grid two-col" style={{ marginBottom: 16, alignItems: "start" }}>
        <PlanoCard nome="Mensal" preco={money(PLANO_MENSAL)} sub="por mês · cancele quando quiser" atual />
        <PlanoCard nome="Anual" preco={money(PLANO_ANUAL_MES)} sub={`por mês · ${money(PLANO_ANUAL_MES * 12)}/ano · economize ${money((PLANO_MENSAL - PLANO_ANUAL_MES) * 12)}`} destaque />
      </div>

      {/* histórico de faturas */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 18px 4px" }}>
          <div className="t">Faturas</div>
          <span className="badge">{FATURAS_MOCK.length}</span>
        </div>
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
              {FATURAS_MOCK.map((f) => {
                const st = STATUS_META[f.status];
                return (
                  <tr key={f.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "10px 18px", fontWeight: 600 }}>{f.competencia}</td>
                    <td style={{ padding: "10px 18px", color: "var(--label-2)" }}>{f.venc}</td>
                    <td style={{ padding: "10px 18px", textAlign: "right" }} className="tnum">
                      {f.valor > 0 ? money(f.valor) : <span style={{ color: "var(--excelente)", fontWeight: 700 }}>grátis</span>}
                    </td>
                    <td style={{ padding: "10px 18px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: st.cor }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.cor }} />
                        {st.lbl}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PlanoCard({ nome, preco, sub, atual, destaque }: { nome: string; preco: string; sub: string; atual?: boolean; destaque?: boolean }) {
  return (
    <div className="card" style={{ padding: "18px 20px", border: destaque ? "1.5px solid var(--cyan)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 15 }}>{nome}</b>
        {atual && <span className="badge" style={{ background: "var(--excelente)", color: "#fff" }}>plano atual</span>}
        {destaque && <span className="badge" style={{ background: "var(--cyan)", color: "#fff" }}>economize</span>}
      </div>
      <div className="tnum" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px" }}>{preco}</div>
      <div style={{ fontSize: 12.5, color: "var(--label-2)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
