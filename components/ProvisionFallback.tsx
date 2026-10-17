"use client";
import Link from "next/link";

/** Falha ao provisionar workspace (banco indisponível, migrate pendente, etc.). */
export function ProvisionFallback() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-mark">C</div>
        <h1 className="auth-title">Quase lá</h1>
        <p className="auth-sub">
          Sua conta foi criada, mas não conseguimos preparar o ambiente agora. Isso costuma ser temporário — tente de novo em alguns instantes.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="btn-link ig auth-btn"
            onClick={() => window.location.reload()}
          >
            Tentar de novo
          </button>
          <Link href="/login" className="auth-alt" style={{ marginTop: 4 }}>
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}
