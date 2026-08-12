"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/AuthShell";

export default function CadastroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data.session) {
      // "Confirm email" desligado → já logado
      router.push("/");
      router.refresh();
    } else {
      setOk("Cadastro criado. Confira seu e-mail para confirmar e depois entre.");
    }
  }

  return (
    <AuthShell titulo="Criar conta" sub="Seu ambiente próprio na Casinha, do zero.">
      <form onSubmit={submit} className="auth-form">
        <label className="field-lbl">E-mail</label>
        <input className="field-edit" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        <label className="field-lbl">Senha</label>
        <input className="field-edit" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required autoComplete="new-password" minLength={6} />
        {err && <div className="auth-err">{err}</div>}
        {ok && <div className="auth-ok">{ok}</div>}
        <button className="btn-link ig auth-btn" type="submit" disabled={loading}>
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>
      <p className="auth-alt">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </AuthShell>
  );
}
