// POST /api/zernio/disconnect  body { accountId }
// Desconecta uma conta conectada (social ou ads). Valida que a conta pertence ao workspace
// antes de chamar o DELETE /accounts/{id} da Zernio (não deixa desconectar conta de outro tenant).
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { disconnectAccount } from "@/lib/zernio";
import { listWorkspaceAccounts } from "@/lib/profiles";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { accountId?: string };
    const accountId = String(body.accountId || "").trim();
    if (!accountId) return NextResponse.json({ ok: false, error: "accountId ausente" }, { status: 400 });

    // segurança: só desconecta conta que está nos profiles DESTE workspace
    const accounts = await listWorkspaceAccounts(ws);
    const alvo = accounts.find((a) => a._id === accountId);
    if (!alvo) return NextResponse.json({ ok: false, error: "conta não pertence a este workspace" }, { status: 403 });

    await disconnectAccount(accountId);
    void logEvent(ws.id, "channel.disconnect", String(alvo.platform || ""), { accountId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
