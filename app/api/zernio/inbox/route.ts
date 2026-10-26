// GET /api/zernio/inbox?accountId=&platform=&since=&until=
// Inbox analytics (conversas/DMs): volume + tempo de resposta + fontes.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { findWorkspaceAccount } from "@/lib/profiles";
import { inboxVolume, inboxResponseTime, inboxSourceBreakdown } from "@/lib/zernio";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const q = new URL(req.url).searchParams;
    const accountId = q.get("accountId") ?? "";
    const platform = q.get("platform") ?? undefined;
    if (!accountId) return NextResponse.json({ error: "accountId ausente" }, { status: 400 });
    const account = await findWorkspaceAccount(ws, accountId);
    if (!account) return NextResponse.json({ error: "conta não encontrada" }, { status: 404 });
    const fromDate = q.get("since") ?? undefined;
    const toDate = q.get("until") ?? undefined;
    const o = { fromDate, toDate, accountId: account._id, platform };

    const [volume, responseTime, sources] = await Promise.all([
      inboxVolume(o).catch(() => null),
      inboxResponseTime(o).catch(() => null),
      inboxSourceBreakdown(o).catch(() => null),
    ]);

    return NextResponse.json({ volume, responseTime, sources });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
