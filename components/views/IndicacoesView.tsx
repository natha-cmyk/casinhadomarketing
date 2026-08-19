"use client";
// Indicações — dados reais (persistidos). Link personalizado pro WhatsApp comercial +
// histórico/rastreio das indicações que viraram cliente (canal de aquisição).
// Conversão hoje é manual (a Casinha registra). Automação via CRM comercial vem depois.
import { useEffect, useMemo, useState } from "react";
import { PageHead, KpiCard } from "@/components/ui";
import { Spinner } from "@/components/Spinner";
import { useStore } from "@/lib/store";

const WHATS_COMERCIAL = "5584981352287"; // WhatsApp comercial oficial (E.164, sem +)

interface Ref { id: string; cliente: string; status: "convertido" | "negociando" | "convidado"; abonouMes: string | null; createdAt: string }
const STATUS_META: Record<string, { lbl: string; cor: string }> = {
  convertido: { lbl: "Convertido", cor: "var(--excelente)" },
  negociando: { lbl: "Em negociação", cor: "var(--atencao)" },
  convidado: { lbl: "Convidado", cor: "var(--label-3)" },
};
const dt = (s: string) => new Date(s).toLocaleDateString("pt-BR");

export default function IndicacoesView() {
  const perfil = useStore((s) => s.perfil);
  const nome = (perfil.empresa || "").trim() || "sua empresa";
  const [copiado, setCopiado] = useState(false);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch("/api/billing", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (alive) setRefs(Array.isArray(d?.referrals) ? d.referrals : []); })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const convertidos = refs.filter((i) => i.status === "convertido").length;
  const negociando = refs.filter((i) => i.status === "negociando").length;
  const abonados = refs.filter((i) => i.abonouMes).length;

  const link = useMemo(() => {
    const msg = `Olá! Sou indicação de ${nome} e quero garantir meu acesso à Casinha do Marketing.`;
    return `https://wa.me/${WHATS_COMERCIAL}?text=${encodeURIComponent(msg)}`;
  }, [nome]);
  const copiar = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) { navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }
  };

  return (
    <>
      <PageHead eyebrow="Conta" title="Programa de indicações" desc="Indique a Casinha e abone mensalidades. Cada indicação que vira cliente zera a sua próxima fatura." />

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <KpiCard lbl="Indicações" val={String(refs.length)} foot="no total" />
        <KpiCard lbl="Em negociação" val={String(negociando)} foot="no funil comercial" />
        <KpiCard lbl="Convertidas" val={String(convertidos)} foot="viraram cliente" tone="pos" />
        <KpiCard lbl="Meses abonados" val={String(abonados)} foot="mensalidades zeradas" tone="pos" />
      </div>

      <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div className="card-head" style={{ marginBottom: 6 }}>
          <div className="t">Seu link de indicação</div>
          <span className="badge">1 conversão = 1 mês grátis</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--label-2)", margin: "0 0 14px", lineHeight: 1.55 }}>
          Compartilhe o link. Quem chegar por ele cai direto no nosso WhatsApp comercial já dizendo
          <i> &quot;sou indicação de {nome}&quot;</i> — a gente registra a origem e credita a você.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="field-edit" readOnly value={link} onFocus={(e) => e.target.select()} style={{ flex: "1 1 280px", fontSize: 12.5 }} />
          <button className="btn-link ig" type="button" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar link"}</button>
          <a className="btn-link" href={link} target="_blank" rel="noopener">Testar no WhatsApp ↗</a>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-head" style={{ padding: "16px 18px 4px" }}>
          <div className="t">Histórico de indicações</div>
          <span className="badge">{refs.length}</span>
        </div>
        {loading ? <div style={{ padding: 18 }}><Spinner texto="Carregando…" /></div> : refs.length === 0 ? (
          <div style={{ padding: "8px 18px 18px", fontSize: 13, color: "var(--label-3)" }}>Nenhuma indicação registrada ainda. Compartilhe seu link — quando alguém fechar, aparece aqui.</div>
        ) : (
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
                {refs.map((i) => {
                  const st = STATUS_META[i.status] ?? STATUS_META.convidado;
                  return (
                    <tr key={i.id} style={{ borderTop: "1px solid var(--hairline)" }}>
                      <td style={{ padding: "10px 18px", fontWeight: 600 }}>{i.cliente}</td>
                      <td style={{ padding: "10px 18px", color: "var(--label-2)" }}>{dt(i.createdAt)}</td>
                      <td style={{ padding: "10px 18px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: st.cor }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.cor }} />{st.lbl}
                        </span>
                      </td>
                      <td style={{ padding: "10px 18px" }} className="tnum">{i.abonouMes ? <span style={{ color: "var(--excelente)", fontWeight: 700 }}>{i.abonouMes}</span> : <span style={{ color: "var(--label-3)" }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tfoot-note" style={{ marginTop: 12 }}>
        A confirmação de conversão é registrada pela Casinha (manual por ora). A automação via CRM comercial entra numa próxima etapa.
      </div>
    </>
  );
}
