// GET /api/cron/db-ping — diagnóstico de conexão Postgres (sem senhas). Protegido por CRON_SECRET.
import { NextResponse } from "next/server";
import { describeDbEnv, pingDatabase } from "@/lib/db-env-diagnostics";
import { cronDenied } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = cronDenied(req);
  if (denied) return denied;

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
