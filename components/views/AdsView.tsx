"use client";
// Estado vazio: workspace novo não tem contas de anúncio conectadas. Métricas de mídia paga chegam via conexões.
import Link from "next/link";
import { PageHead } from "@/components/ui";
import { ConexoesGrid } from "@/components/ConexoesGrid";

export function AdsView() {
  return (
    <>
      <PageHead
        eyebrow="COMERCIAL · AQUISIÇÃO"
        title="Canais Pagos"
        desc="Investimento, ROAS e CAC por canal — via contas de anúncio conectadas."
      />

      <div className="card pad-lg" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <div>
            <div className="t">Plataformas de anúncio</div>
            <div className="sub">Conecte Meta Ads, Google Ads e outras plataformas — as métricas de mídia paga aparecem aqui depois.</div>
          </div>
        </div>
        <ConexoesGrid grupos={["ads"]} />
      </div>

      <div className="empty">
        <div className="e-ico">📣</div>
        <h3>Nenhuma conta de anúncio conectada</h3>
        <p>
          Conecte uma plataforma acima, ou vá em{" "}
          <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>
            Personalização → Conexões
          </Link>{" "}
          — as métricas de mídia paga aparecem aqui depois.
        </p>
      </div>
    </>
  );
}
