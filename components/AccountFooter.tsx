"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/env";

// Rodapé da sidebar: e-mail do usuário logado + sair. Se o Supabase não estiver
// configurado (anon key vazia), mostra o status antigo de prévia.
export function AccountFooter() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const configured = supabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, [configured]);

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!configured) {
    return (
      <div className="sb-foot">
        <span className="dot" />
        Prévia · dados reais
      </div>
    );
  }

  return (
    <div className="sb-foot acct">
      <span className="dot" />
      <span className="acct-email" title={email ?? ""}>{email ?? "—"}</span>
      <button className="acct-sair" onClick={sair} type="button">Sair</button>
    </div>
  );
}
