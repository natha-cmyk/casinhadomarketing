// Rota de teste: valida a ZERNIO_API_KEY e lista as contas conectadas.
// GET /api/zernio/accounts
import { NextResponse } from "next/server";
import { listAccounts } from "@/lib/zernio";

export async function GET() {
  try {
    const data = await listAccounts();
    return NextResponse.json({ ok: true, ...data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }
}
