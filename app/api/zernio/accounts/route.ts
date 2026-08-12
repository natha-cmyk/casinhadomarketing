// GET /api/zernio/accounts — contas conectadas do profile do workspace ativo.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { listAccounts } from "@/lib/zernio";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
    if (!ws.zernioProfileId) return NextResponse.json({ ok: true, accounts: [] });
    const data = await listAccounts(ws.zernioProfileId);
    return NextResponse.json({ ok: true, accounts: data.accounts });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e), accounts: [] }, { status: 502 });
  }
}
