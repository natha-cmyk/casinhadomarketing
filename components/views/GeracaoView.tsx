"use client";
// Estado vazio: workspace novo não tem origem de leads. A entrada virá por importação/manual (em breve).
import Link from "next/link";
import { PageHead } from "@/components/ui";

export function GeracaoView() {
  return (
    <>
      <PageHead
        eyebrow="COMERCIAL · FUNIL"
        title="Geração por Canais"
        desc="De onde vêm os leads — por produto e canal."
      />

      <div className="empty">
        <div className="e-ico">📥</div>
        <h3>Geração ainda não configurada</h3>
        <p>
          A origem dos seus leads vai aparecer aqui assim que houver dados. Em breve você poderá alimentar por{" "}
          <b>importação</b> ou <b>entrada manual</b>. Configure as bases do workspace em{" "}
          <Link href="/personalizacao" style={{ color: "var(--cyan)", fontWeight: 650 }}>
            Personalização
          </Link>
          .
        </p>
      </div>
    </>
  );
}
