// GET /api/billing — assinatura + faturas + indicações do workspace ativo.
// Billing sem provider ainda (dados reais, editáveis). Cria uma assinatura default no 1º acesso.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json(null, { status: 401 });

    let subscription = await prisma.subscription.findUnique({ where: { workspaceId: ws } });
    if (!subscription) {
      subscription = await prisma.subscription.create({ data: { workspaceId: ws } }).catch(() => null);
    }
    const [invoices, referrals] = await Promise.all([
      prisma.invoice.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "desc" }, take: 24 }),
      prisma.referral.findMany({ where: { workspaceId: ws }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    return NextResponse.json({ subscription, invoices, referrals });
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
