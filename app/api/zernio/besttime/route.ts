// GET /api/zernio/besttime?accountId=&platform= — melhores horários (engajamento médio por
// dia×hora) da conta, pra sugerir horário no agendamento. Best-effort: erro → lista vazia.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { bestTime } from "@/lib/zernio";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ws = await getActiveWorkspace();
  if (!ws) return NextResponse.json({ slots: [] }, { status: 401 });
  const u = new URL(req.url);
  const accountId = u.searchParams.get("accountId");
  const platform = u.searchParams.get("platform");
  if (!accountId || !platform) return NextResponse.json({ slots: [] });
  try {
    const slots = await bestTime(accountId, platform);
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json({ slots: [] });
  }
}
