"use client";
// Painel (overview) por workspace: agrega as contas conectadas na Zernio.
// Vazio quando nada conectado (CTA p/ Personalização). Sem números fixos.
import Link from "next/link";
import { useStore } from "@/lib/store";
import { REDES } from "@/lib/seed-data";
import { PageHead, KpiCard } from "@/components/ui";
import { Ic } from "@/components/Ic";
import { fmt } from "@/lib/format";
import { pathForView } from "@/lib/nav";

const ATALHOS = [
  { id: "instagram", icon: "ig", label: "Instagram", desc: "métricas da rede" },
  { id: "canais", icon: "leads", label: "Geração", desc: "origem dos leads" },
  { id: "ads", icon: "ads", label: "Canais Pagos", desc: "mídia paga" },
  { id: "persona", icon: "persona", label: "Persona", desc: "público & CRM" },
  { id: "concorrencia", icon: "vs", label: "Concorrência", desc: "benchmark" },
];

const redeLabel = (p: string) => REDES.find((r) => r.id === p || (r.id === "x" && p === "twitter"))?.label || p;
const redeCor = (p: string) => REDES.find((r) => r.id === p || (r.id === "x" && p === "twitter"))?.cor || "#121111";

export function PainelView() {
  const accounts = useStore((s) => s.zernioAccounts);
  const totalSeg = accounts.reduce((a, x) => a + (x.followersCount || 0), 0);

  return (
    <>
      <PageHead
        eyebrow="VISÃO GERAL"
        title="Painel"
        desc="Resumo do ambiente — contas conectadas e atalhos. Conecte suas redes em Personalização para popular os indicadores."
      />

      {accounts.length === 0 ? (
        <div className="empty">
          <div className="e-ico" style={{ fontSize: 22 }}>📡</div>
          <h3>Ambiente sem contas conectadas</h3>
          <p>
            Vá em{" "}
            <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>
              Personalização → Conexões
            </Link>{" "}
            e conecte suas redes. Os painéis passam a mostrar seus dados reais.
          </p>
        </div>
      ) : (
        <div className="grid" style={{ gap: 16 }}>
          <div className="grid kpis">
            <KpiCard lbl="Contas conectadas" val={fmt(accounts.length)} foot="sociais, conversas e ads" />
            <KpiCard lbl="Seguidores (total)" val={totalSeg ? fmt(totalSeg) : "—"} foot="somados nas redes" />
          </div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            {accounts.map((a) => (
              <div className="card rede-mini" key={a._id}>
                <div className="rm-h">
                  <span className="rede-dot" style={{ background: redeCor(a.platform) }} />
                  {redeLabel(a.platform)}
                </div>
                <div className="rm-kpis">
                  <div>
                    <span className="rm-v tnum">{a.followersCount != null ? fmt(a.followersCount) : "—"}</span>
                    <span className="rm-l">Seguidores</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <div className="ind-h" style={{ marginBottom: 8 }}>Atalhos</div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
          {ATALHOS.map((a) => (
            <Link key={a.id} href={pathForView(a.id)} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="ico" style={{ color: "var(--red)" }}>
                <Ic name={a.icon} />
              </span>
              <b style={{ fontSize: 13.5 }}>{a.label}</b>
              <span style={{ fontSize: 11.5, color: "var(--label-3)" }}>{a.desc}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
