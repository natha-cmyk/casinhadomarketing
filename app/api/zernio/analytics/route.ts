// GET /api/zernio/analytics?platform=instagram&accountId=...&since=YYYY-MM-DD&until=YYYY-MM-DD
// Insights de uma conta conectada (do profile do workspace).
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { findWorkspaceAccount } from "@/lib/profiles";
import { accountInsights } from "@/lib/zernio";
import { clientError } from "@/lib/route-error";

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const q = new URL(req.url).searchParams;
    const platform = q.get("platform");
    const accountId = q.get("accountId");
    if (!platform || !accountId)
      return NextResponse.json({ error: "platform/accountId ausentes" }, { status: 400 });
    const account = await findWorkspaceAccount(ws, accountId);
    if (!account) return NextResponse.json({ error: "conta não encontrada" }, { status: 404 });

    const data = await accountInsights(platform, account._id, {
      since: q.get("since") ?? undefined,
      until: q.get("until") ?? undefined,
      metrics: q.get("metrics") ?? undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: clientError("zernio/analytics", e, "Não foi possível carregar as métricas.") }, { status: 502 });
  }
}
