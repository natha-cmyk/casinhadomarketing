// Admin · Links de cadastro personalizados (plano + trial). GET lista; POST cria e devolve a URL.
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/email";
import { PLANO_LABEL, type Plano } from "@/lib/stripe";

export const dynamic = "force-dynamic";
const PLANOS: Plano[] = ["mensal", "anual_parcelado", "anual_avista"];
const rndToken = () => Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10)).join("");

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });
  const rows = await prisma.signupLink.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const items = rows.map((r) => ({
    id: r.id, token: r.token, nomeAcao: r.nomeAcao, plano: r.plano, planoLabel: PLANO_LABEL[r.plano as Plano] || r.plano,
    trialDays: r.trialDays, url: `${APP_URL}/cadastro?c=${r.token}`,
    usadoPorEmail: r.usadoPorEmail, usadoEm: r.usadoEm, createdAt: r.createdAt,
  }));
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const plano = PLANOS.includes(b?.plano) ? (b.plano as Plano) : "mensal";
  const trialDays = [0, 7, 90].includes(Number(b?.trialDays)) ? Number(b.trialDays) : 0;
  const nomeAcao = String(b?.nomeAcao || "").trim().slice(0, 120);
  const token = rndToken();
  await prisma.signupLink.create({ data: { token, nomeAcao, plano, trialDays, criadoPor: admin.email || "" } });
  return NextResponse.json({ ok: true, token, url: `${APP_URL}/cadastro?c=${token}` });
}

export async function DELETE(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (id) await prisma.signupLink.deleteMany({ where: { id } });
  return NextResponse.json({ ok: true });
}
