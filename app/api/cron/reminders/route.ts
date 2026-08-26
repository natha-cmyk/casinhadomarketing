// GET /api/cron/reminders — lembrete de "conexões pendentes".
// Semanal (vercel.json). Pra cada workspace SEM canais conectados e com +3 dias de vida,
// manda 1 e-mail ao dono e registra um evento "reminder.connections" — que serve de trava
// pra nunca reenviar (idempotente). Protegido por CRON_SECRET, igual ao crm-sync.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { connectionsReminderEmail } from "@/lib/email-templates";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// tem algum canal conectado? Zernio (profile primário/extra) ou alguma rede marcada true.
function temConexao(ws: { zernioProfileId: string | null; profiles: unknown[]; envConfig: { redes: unknown } | null }): boolean {
  if (ws.zernioProfileId) return true;
  if (ws.profiles.length > 0) return true;
  const redes = ws.envConfig?.redes;
  if (redes && typeof redes === "object") {
    if (Object.values(redes as Record<string, unknown>).some(Boolean)) return true;
  }
  return false;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const workspaces = await prisma.workspace.findMany({
    where: { createdAt: { lt: tresDiasAtras } },
    include: {
      envConfig: { select: { redes: true } },
      profiles: { select: { id: true } },
      memberships: { where: { role: "owner" }, include: { user: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  let enviados = 0;
  const pulados: string[] = [];
  for (const ws of workspaces) {
    if (temConexao(ws)) { pulados.push(ws.id); continue; }
    // trava: já lembramos esse workspace? não reenvia.
    const jaLembrou = await prisma.event.findFirst({ where: { workspaceId: ws.id, type: "reminder.connections" } });
    if (jaLembrou) { pulados.push(ws.id); continue; }

    const email = ws.memberships[0]?.user.email;
    if (!email) { pulados.push(ws.id); continue; }

    const nome = ws.memberships[0]?.user.nome || undefined;
    const t = connectionsReminderEmail(nome);
    const ok = await sendEmail({ to: email, subject: t.subject, html: t.html });
    if (ok) {
      await logEvent(ws.id, "reminder.connections", email);
      enviados++;
    }
  }

  return NextResponse.json({ ok: true, workspaces: workspaces.length, enviados, pulados: pulados.length });
}
