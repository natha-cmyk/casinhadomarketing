"use client";
// Assinatura & Indicações — MOCKUP (billing ainda sem provider). Faturas de exemplo +
// programa de indicação com link personalizado pro WhatsApp comercial (contagem manual por ora).
// TODO(billing): ligar num provider real (ciclo/próxima cobrança/faturas). TODO(indicacoes):
// confirmar conversão automática (hoje manual). Ver roadmap.
import { useMemo, useState } from "react";
import { PageHead, KpiCard } from "@/components/ui";
import { useStore } from "@/lib/store";
import { money } from "@/lib/format";

// número do WhatsApp comercial da Casinha (placeholder — trocar pelo oficial).
const WHATS_COMERCIAL = "5584999999999";
const MENSALIDADE = 297; // valor de exemplo

// faturas MOCK (estrutura pronta pro provider real)
type Fatura = { id: string; competencia: string; valor: number; status: "paga" | "abonada" | "aberta"; venc: string };
const FATURAS_MOCK: Fatura[] = [
  { id: "f6", competencia: "Ago/2026", valor: MENSALIDADE, status: "aberta", venc: "10/09/2026" },
  { id: "f5", competencia: "Jul/2026", valor: 0, status: "abonada", venc: "10/08/2026" },
  { id: "f4", competencia: "Jun/2026", valor: MENSALIDADE, status: "paga", venc: "10/07/2026" },
  { id: "f3", competencia: "Mai/2026", valor: MENSALIDADE, status: "paga", venc: "10/06/2026" },
  { id: "f2", competencia: "Abr/2026", valor: 0, status: "abonada", venc: "10/05/2026" },
  { id: "f1", competencia: "Mar/2026", valor: MENSALIDADE, status: "paga", venc: "10/04/2026" },
];

const STATUS_META: Record<Fatura["status"], { lbl: string; cor: string }> = {
  paga: { lbl: "Paga", cor: "var(--excelente)" },
  abonada: { lbl: "Abonada (indicação)", cor: "var(--cyan)" },
  aberta: { lbl: "Em aberto", cor: "var(--atencao)" },
};

export default function AssinaturaView() {
  const perfil = useStore((s) => s.perfil);
  const nome = (perfil.empresa || "").trim() || "sua empresa";
  const [copiado, setCopiado] = useState(false);

  const abonadas = FATURAS_MOCK.filter((f) => f.status === "abonada").length;
  const proxima = FATURAS_MOCK.find((f) => f.status === "aberta");

  // link de indicação → abre o WhatsApp comercial com a mensagem pronta
  const link = useMemo(() => {
    const msg = `Olá! Sou indicação de ${nome} e quero garantir meu acesso à Casinha do Marketing.`;
    return `https://wa.me/${WHATS_COMERCIAL}?text=${encodeURIComponent(msg)}`;
  }, [nome]);

  const copiar = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  };

  return (
    <>
      <PageHead
        eyebrow="Conta"
        title="Assinatura & Indicações"
        desc="Acompanhe suas faturas e indique a Casinha — cada conversão abona a mensalidade do mês seguinte."
      />

      <div className="insight" style={{ marginBottom: 16 }}>
        <p><b>Prévia.</b> Os valores de fatura abaixo são exemplos — a cobrança real entra quando ligarmos o meio de pagamento. O link de indicação já funciona.</p>
      </div>

      {/* ===== Assinatura ===== */}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Plano" val="Casinha" foot="mensal" />
        <KpiCard lbl="Mensalidade" val={money(MENSALIDADE)} foot="por mês" />
        <KpiCard lbl="Próxima cobrança" val={proxima ? proxima.venc : "—"} foot={proxima ? proxima.competencia : "em dia"} />
        <KpiCard lbl="Meses abonados" val={String(abonadas)} foot="por indicação" tone="pos" />
      </div>

      {/* histórico de faturas */}
      <div className="card" style={{ marginBottom: 16, padding: 0 }}>
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

      {/* ===== Indicações ===== */}
      <div className="card" style={{ padding: "18px 20px" }}>
        <div className="card-head" style={{ marginBottom: 6 }}>
          <div className="t">Programa de indicações</div>
          <span className="badge">1 conversão = 1 mês grátis</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--label-2)", margin: "0 0 14px", lineHeight: 1.55 }}>
          Compartilhe seu link. Quem chegar por ele cai direto no nosso WhatsApp comercial com a mensagem
          <i> &quot;sou indicação de {nome}&quot;</i>. A cada indicação que vira cliente, sua <b>próxima mensalidade é abonada</b>.
        </p>

        <label className="field-lbl">Seu link de indicação</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <input className="field-edit" readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: "1 1 280px", fontSize: 12.5 }} />
          <button className="btn-link ig" type="button" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar link"}</button>
          <a className="btn-link" href={link} target="_blank" rel="noopener">Testar no WhatsApp ↗</a>
        </div>

        {/* acompanhamento (manual por ora) */}
        <div className="mini">
          <MiniBox l="Cliques no link" n="—" hint="em breve" />
          <MiniBox l="Indicações em negociação" n="—" hint="via CRM comercial" />
          <MiniBox l="Convertidas" n={String(abonadas)} hint="mensalidades abonadas" />
        </div>
        <div className="tfoot-note" style={{ marginTop: 12 }}>
          Por ora a confirmação de conversão é manual (a Casinha marca quando o indicado fecha). A automação
          via CRM comercial entra numa próxima etapa.
        </div>
      </div>
    </>
  );
}

function MiniBox({ l, n, hint }: { l: string; n: string; hint: string }) {
  return (
    <div className="m">
      <div className="l">{l}</div>
      <div className="n tnum">{n}</div>
      <div style={{ fontSize: 11, color: "var(--label-3)", marginTop: 2 }}>{hint}</div>
    </div>
  );
}
