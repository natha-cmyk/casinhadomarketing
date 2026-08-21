// /api/admin/billing — gestão manual de assinatura/faturas/indicações (só admin da agência).
// Enquanto o Stripe não entra, a Seahub registra faturas, cadastra indicações e marca
// conversões (que abonam a mensalidade) por aqui.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminUser } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { referralConvertedEmail, referralRegisteredEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      invoices: { orderBy: { createdAt: "desc" }, take: 24 },
      referrals: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  return NextResponse.json({ ok: true, workspaces });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const type = String(b?.type || "");
  const ws = String(b?.workspaceId || "");
  const int = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : d);
  const dateOrNull = (v: unknown) => (v ? new Date(String(v)) : null);

  try {
    if (type === "subscription") {
      if (!ws) return NextResponse.json({ ok: false, error: "workspaceId" }, { status: 400 });
      const data = {
        plano: b.plano === "anual" ? "anual" : "mensal",
        valorMensal: int(b.valorMensal, 500),
        valorAnualMes: int(b.valorAnualMes, 420),
        proximaCobranca: dateOrNull(b.proximaCobranca),
        status: String(b.status || "ativa"),
      };
      const sub = await prisma.subscription.upsert({ where: { workspaceId: ws }, create: { workspaceId: ws, ...data }, update: data });
      return NextResponse.json({ ok: true, subscription: sub });
    }
    if (type === "invoice") {
      if (!ws || !b.competencia) return NextResponse.json({ ok: false, error: "dados" }, { status: 400 });
      const inv = await prisma.invoice.create({
        data: { workspaceId: ws, competencia: String(b.competencia), valor: int(b.valor), status: String(b.status || "aberta"), vencimento: dateOrNull(b.vencimento) },
      });
      return NextResponse.json({ ok: true, invoice: inv });
    }
    if (type === "referral") {
      if (!ws || !b.cliente) return NextResponse.json({ ok: false, error: "dados" }, { status: 400 });
      const status = String(b.status || "convidado");
      const abonouMes = b.abonouMes ? String(b.abonouMes) : null;
      const ref = await prisma.referral.create({ data: { workspaceId: ws, cliente: String(b.cliente), status, abonouMes } });
      // avisa o dono do ambiente: convertido = recompensa; senão = confirmação de que registramos
      const owner = await prisma.membership.findFirst({ where: { workspaceId: ws, role: "owner" }, include: { user: true }, orderBy: { createdAt: "asc" } });
      if (owner?.user.email) {
        const t = status === "convertido"
          ? referralConvertedEmail({ cliente: String(b.cliente), mes: abonouMes })
          : referralRegisteredEmail({ cliente: String(b.cliente) });
        await sendEmail({ to: owner.user.email, subject: t.subject, html: t.html });
      }
      return NextResponse.json({ ok: true, referral: ref });
    }
    if (type === "delete-invoice") { await prisma.invoice.delete({ where: { id: String(b.id) } }).catch(() => {}); return NextResponse.json({ ok: true }); }
    if (type === "delete-referral") { await prisma.referral.delete({ where: { id: String(b.id) } }).catch(() => {}); return NextResponse.json({ ok: true }); }
    return NextResponse.json({ ok: false, error: "tipo inválido" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "db" }, { status: 503 });
  }
}
