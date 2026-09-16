"use client";
// Rede de segurança de ÚLTIMO recurso: só dispara se o próprio layout RAIZ falhar (fora do alcance
// do (app)/error.tsx). Substitui a árvore inteira, então precisa renderizar seu próprio <html>/<body>
// e não conta com o CSS/fonte da app — estilos inline e fonte de sistema de propósito.
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[GlobalError]", error); }, [error]);
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#EDEDEC", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: "#121111" }}>
        <div style={{ background: "#fff", border: "1px solid #e6e6e4", borderRadius: 16, padding: "28px 26px", maxWidth: 420, textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,.08)" }}>
          <div style={{ fontSize: 30 }}>⚠️</div>
          <h2 style={{ fontSize: 18, margin: "10px 0 6px" }}>A plataforma tropeçou</h2>
          <p style={{ fontSize: 13.5, color: "#6b6b70", margin: "0 0 16px", lineHeight: 1.5 }}>Recarregue a página. Se persistir, tente de novo em instantes.</p>
          <button type="button" onClick={() => reset()} style={{ padding: "9px 18px", border: "none", borderRadius: 999, background: "#121111", color: "#fff", fontWeight: 650, fontSize: 13.5, cursor: "pointer" }}>
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
