// GET /api/cron/purge-trash — apaga DE VEZ os posts na lixeira há mais de 7 dias.
// Diário (vercel.json). Protegido por CRON_SECRET, igual aos outros crons.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cronDenied } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;
  const corte = new Date(Date.now() - 7 * 86400000);
  const r = await prisma.post.deleteMany({ where: { deletedAt: { lt: corte } } });
  return NextResponse.json({ ok: true, purgados: r.count });
}
