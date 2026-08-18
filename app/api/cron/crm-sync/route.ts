// GET /api/cron/crm-sync — sync diário (meia-noite) de TODOS os workspaces com ClickUp.
// Disparado pelo Vercel Cron (vercel.json). Protegido: exige o header do Vercel Cron
// (Authorization: Bearer $CRON_SECRET) quando CRON_SECRET estiver setado.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncClickupLeads } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  // valida o disparo do Vercel Cron (evita chamada pública abusar do endpoint)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const configs = await prisma.crmConfig.findMany({
    where: { provider: "clickup", NOT: [{ clickupToken: null }, { clickupListId: null }] },
    select: { workspaceId: true },
  });

  const results: { workspaceId: string; ok: boolean; imported?: number; error?: string }[] = [];
  // sequencial pra não estourar rate limit do ClickUp entre workspaces
  for (const c of configs) {
    try {
      const r = await syncClickupLeads(c.workspaceId); // incremental
      results.push(r.ok ? { workspaceId: c.workspaceId, ok: true, imported: r.imported } : { workspaceId: c.workspaceId, ok: false, error: r.error });
    } catch (e) {
      results.push({ workspaceId: c.workspaceId, ok: false, error: String(e) });
    }
  }

  const synced = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, workspaces: configs.length, synced, results });
}
