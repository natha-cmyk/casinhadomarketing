"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function google() {
    setErr(null);
    const supabase = createClient();
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setErr(error.message.includes("provider is not enabled") ? "Login com Google ainda não está habilitado. Use e-mail e senha." : error.message);
  }

  return (
    <AuthShell titulo="Entrar" sub="Acesse o seu ambiente na Casinha.">
      <form onSubmit={submit} className="auth-form">
        <label className="field-lbl">E-mail</label>
        <input className="field-edit" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <label className="field-lbl">Senha</label>
        <input className="field-edit" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="current-password" />
        {err && <div className="auth-err">{err}</div>}
        <button className="btn-link ig auth-btn" type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0", color: "var(--label-3)", fontSize: 12 }}>
        <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} /> ou <span style={{ flex: 1, height: 1, background: "var(--hairline)" }} />
      </div>
      <button className="btn-link auth-btn" type="button" onClick={google} style={{ width: "100%", justifyContent: "center", border: "1px solid var(--hairline)" }}>
        Entrar com Google
      </button>
      <p className="auth-alt">
        Não tem conta? <Link href="/cadastro">Cadastre-se</Link>
      </p>
    </AuthShell>
  );
}
