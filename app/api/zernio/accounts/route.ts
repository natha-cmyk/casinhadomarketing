// GET /api/zernio/accounts — contas conectadas do profile do workspace ativo.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { listWorkspaceAccounts } from "@/lib/profiles";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    // agrega contas de TODOS os profiles do workspace (multi-conta)
    const accounts = await listWorkspaceAccounts(ws);
    return NextResponse.json({ ok: true, accounts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 502 });
  }
}
