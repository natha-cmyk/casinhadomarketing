"use client";
// Indicações — programa de indicação (aba própria). Link personalizado pro WhatsApp comercial
// + histórico/rastreio de indicações que viraram cliente (canal de aquisição).
// MOCKUP: histórico de exemplo; conversão hoje é manual (a Casinha marca). TODO(indicacoes):
// automação via CRM comercial + contagem real de cliques.
import { useMemo, useState } from "react";
import { PageHead, KpiCard } from "@/components/ui";
import { useStore } from "@/lib/store";

// WhatsApp comercial oficial da Casinha (E.164, sem +)
const WHATS_COMERCIAL = "5584981352287";

// indicações MOCK — quem veio pela sua indicação e virou cliente (rastreio do canal de aquisição)
type Indicacao = { id: string; cliente: string; data: string; status: "convertido" | "negociando" | "convidado"; abonouMes: string | null };
const INDICACOES_MOCK: Indicacao[] = [
  { id: "i5", cliente: "Studio Aurora", data: "02/08/2026", status: "convertido", abonouMes: "Set/2026" },
  { id: "i4", cliente: "Contabilidade Prisma", data: "21/07/2026", status: "negociando", abonouMes: null },
  { id: "i3", cliente: "Clínica Bem Viver", data: "14/06/2026", status: "convertido", abonouMes: "Jul/2026" },
  { id: "i2", cliente: "AdvocaciaRanieri", data: "30/05/2026", status: "convidado", abonouMes: null },
  { id: "i1", cliente: "Imob. Litoral Norte", data: "12/04/2026", status: "convertido", abonouMes: "Mai/2026" },
];
const STATUS_META: Record<Indicacao["status"], { lbl: string; cor: string }> = {
  convertido: { lbl: "Convertido", cor: "var(--excelente)" },
  negociando: { lbl: "Em negociação", cor: "var(--atencao)" },
  convidado: { lbl: "Convidado", cor: "var(--label-3)" },
};

export default function IndicacoesView() {
  const perfil = useStore((s) => s.perfil);
  const nome = (perfil.empresa || "").trim() || "sua empresa";
  const [copiado, setCopiado] = useState(false);

  const convertidos = INDICACOES_MOCK.filter((i) => i.status === "convertido").length;
  const negociando = INDICACOES_MOCK.filter((i) => i.status === "negociando").length;
  const abonados = INDICACOES_MOCK.filter((i) => i.abonouMes).length;

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
        title="Programa de indicações"
        desc="Indique a Casinha e abone mensalidades. Cada indicação que vira cliente zera a sua próxima fatura."
      />

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Indicações" val={String(INDICACOES_MOCK.length)} foot="no total" />
        <KpiCard lbl="Em negociação" val={String(negociando)} foot="no funil comercial" />
        <KpiCard lbl="Convertidas" val={String(convertidos)} foot="viraram cliente" tone="pos" />
        <KpiCard lbl="Meses abonados" val={String(abonados)} foot="mensalidades zeradas" tone="pos" />
      </div>

      {/* link de indicação */}
      <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div className="card-head" style={{ marginBottom: 6 }}>
          <div className="t">Seu link de indicação</div>
          <span className="badge">1 conversão = 1 mês grátis</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--label-2)", margin: "0 0 14px", lineHeight: 1.55 }}>
          Compartilhe o link. Quem chegar por ele cai direto no nosso WhatsApp comercial já dizendo
          <i> &quot;sou indicação de {nome}&quot;</i> — então a gente registra a origem e credita a você.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="field-edit" readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: "1 1 280px", fontSize: 12.5 }} />
          <button className="btn-link ig" type="button" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar link"}</button>
          <a className="btn-link" href={link} target="_blank" rel="noopener">Testar no WhatsApp ↗</a>
        </div>
      </div>

      {/* histórico / rastreio das indicações */}
      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 18px 4px" }}>
          <div className="t">Histórico de indicações</div>
          <span className="badge">{INDICACOES_MOCK.length}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--label-3)" }}>
                <th style={{ padding: "8px 18px", fontWeight: 600 }}>Cliente indicado</th>
                <th style={{ padding: "8px 18px", fontWeight: 600 }}>Data</th>
                <th style={{ padding: "8px 18px", fontWeight: 600 }}>Status</th>
                <th style={{ padding: "8px 18px", fontWeight: 600 }}>Mês abonado</th>
              </tr>
            </thead>
            <tbody>
              {INDICACOES_MOCK.map((i) => {
                const st = STATUS_META[i.status];
                return (
                  <tr key={i.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                    <td style={{ padding: "10px 18px", fontWeight: 600 }}>{i.cliente}</td>
                    <td style={{ padding: "10px 18px", color: "var(--label-2)" }}>{i.data}</td>
                    <td style={{ padding: "10px 18px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: st.cor }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.cor }} />
                        {st.lbl}
                      </span>
                    </td>
                    <td style={{ padding: "10px 18px" }} className="tnum">
                      {i.abonouMes ? <span style={{ color: "var(--excelente)", fontWeight: 700 }}>{i.abonouMes}</span> : <span style={{ color: "var(--label-3)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tfoot-note" style={{ marginTop: 12 }}>
        Por ora a confirmação de conversão é manual (a Casinha marca quando o indicado fecha). A automação
        via CRM comercial — pra puxar o cliente e creditar o mês grátis sozinho — entra numa próxima etapa.
      </div>
    </>
  );
}
