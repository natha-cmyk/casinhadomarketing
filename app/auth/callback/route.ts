// Callback do OAuth (Google) e de links mágicos. O provedor volta com ?code=...;
// aqui trocamos o code por uma sessão (grava os cookies) e mandamos pro destino.
// Sem esta rota, o login social "pisca e volta pro /login" (sessão nunca é criada).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // atrás do proxy da Vercel o origin pode vir errado — usa o host encaminhado.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      const base = isLocal ? origin : forwardedHost ? `https://${forwardedHost}` : origin;
      return NextResponse.redirect(`${base}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
