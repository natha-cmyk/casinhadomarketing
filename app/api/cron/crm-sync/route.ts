// GET /api/cron/crm-sync — sync diário (meia-noite) de TODOS os workspaces com ClickUp.
// Disparado pelo Vercel Cron (vercel.json). Protegido: exige o header do Vercel Cron
// (Authorization: Bearer $CRON_SECRET) quando CRON_SECRET estiver setado.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncClickupLeads } from "@/lib/crm-sync";
import { cronDenied } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;

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
