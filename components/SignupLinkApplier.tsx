"use client";
// Após o 1º acesso, se veio de um link de cadastro personalizado (?c= guardado no cadastro),
// aplica o trial ao workspace e remove o token. Roda uma vez, silencioso.
import { useEffect } from "react";

export function SignupLinkApplier() {
  useEffect(() => {
    let token: string | null = null;
    try { token = localStorage.getItem("signupToken"); } catch { /* ignore */ }
    if (!token) return;
    fetch("/api/signup-link/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then((r) => r.json())
      .then(() => { try { localStorage.removeItem("signupToken"); } catch { /* ignore */ } })
      .catch(() => { /* silencioso: não bloqueia o app */ });
  }, []);
  return null;
}
