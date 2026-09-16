"use client";
// Error boundary do AMBIENTE (rota). Como fica DENTRO do (app)/layout.tsx, o Shell (sidebar/toolbar)
// continua no ar — só a área de conteúdo mostra este fallback quando a página inteira falha ao
// renderizar. Erros de bloco/widget são pegos antes, pelo PanelBoundary (fallback menor).
import { useEffect } from "react";

export default function EnvError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // log técnico só no console — nada de detalhe/jargão na tela
    console.error("[EnvError]", error);
  }, [error]);

  return (
    <div className="empty" style={{ maxWidth: 460 }}>
      <div className="e-ico" style={{ fontSize: 26 }}>⚠️</div>
      <h3>Este ambiente não carregou</h3>
      <p>Algo falhou ao montar esta tela. O resto da plataforma continua funcionando — a barra lateral está aí do lado.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
        <button type="button" onClick={reset} className="btn-link" style={{ padding: "7px 16px", border: "1px solid var(--hairline)", borderRadius: 999, fontWeight: 650 }}>
          Tentar de novo
        </button>
        <button type="button" onClick={() => window.location.reload()} className="btn-link" style={{ padding: "7px 16px", border: "1px solid var(--hairline)", borderRadius: 999, fontWeight: 650 }}>
          Recarregar a página
        </button>
      </div>
    </div>
  );
}
