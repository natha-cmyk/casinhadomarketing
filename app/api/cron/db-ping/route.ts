// GET /api/cron/db-ping — diagnóstico de conexão Postgres (sem senhas). Protegido por CRON_SECRET.
import { NextResponse } from "next/server";
import { describeDbEnv, pingDatabase } from "@/lib/db-env-diagnostics";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado neste deploy" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const env = describeDbEnv();
  const ping = await pingDatabase();
  const ok = ping.ok && env.issues.length === 0;

  return NextResponse.json({
    ok,
    env,
    ping,
    hint: ok
      ? "Banco alcançável a partir deste deploy."
      : "Corrija `issues` e/ou `ping.message`; compare com docs/supabase-variaveis-ambiente.md (Preview = branch dev).",
  });
}
