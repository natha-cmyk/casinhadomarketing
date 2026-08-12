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
      <p className="auth-alt">
        Não tem conta? <Link href="/cadastro">Cadastre-se</Link>
      </p>
    </AuthShell>
  );
}
