// POST /api/stripe/checkout { plano } — cliente assina: cria a sessão de Checkout hospedada
// pro workspace ativo e devolve a URL. Sem Stripe configurado → 503 (billing manual segue).
import { NextResponse } from "next/server";
import { getActiveWorkspace, getSessionUser } from "@/lib/auth";
import { stripeConfigured, type Plano } from "@/lib/stripe";
import { createCheckout } from "@/lib/stripe-checkout";

export const dynamic = "force-dynamic";
const PLANOS: Plano[] = ["mensal", "anual_parcelado", "anual_avista"];

export async function POST(req: Request) {
  const [ws, user] = await Promise.all([getActiveWorkspace(), getSessionUser()]);
  if (!ws || !user) return NextResponse.json({ error: "Faça login." }, { status: 401 });
  if (!stripeConfigured()) return NextResponse.json({ error: "Pagamento ainda não está disponível. Fale com a Seahub." }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const plano = PLANOS.includes(b?.plano) ? (b.plano as Plano) : null;
  if (!plano) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  try {
    const url = await createCheckout({ workspaceId: ws.id, email: user.email || undefined, plano });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e).slice(0, 200) }, { status: 400 });
  }
}
