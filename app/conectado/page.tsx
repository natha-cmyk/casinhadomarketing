"use client";
import { useEffect } from "react";
import { AuthShell } from "@/components/AuthShell";

// Página de retorno do OAuth da Zernio (abre no popup). Avisa o app e fecha.
export default function ConectadoPage() {
  useEffect(() => {
    try {
      window.opener?.postMessage("zernio-connected", "*");
    } catch {}
    const t = setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <AuthShell titulo="Conta conectada ✓" sub="Pode fechar esta janela — as métricas aparecem na plataforma.">
      <p style={{ textAlign: "center", fontSize: 13, color: "var(--label-2)", margin: 0 }}>
        Se a janela não fechar sozinha, feche-a e volte para a Casinha.
      </p>
    </AuthShell>
  );
}
