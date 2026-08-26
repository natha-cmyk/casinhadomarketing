// GET /api/cron/health — checa diariamente se algum canal conectado caiu (token revogado/expirado).
// A integração não expõe um campo de status: quando um token cai, a conta some de /accounts.
// Então comparamos o que o workspace conectou (EnvConfig.contas) com a lista viva da Zernio.
// Sumiu da lista viva = caiu → e-mail 1x por conta (trava via Event log; reset quando reconecta).
// Guarda anti-falso-positivo: se a lista viva vier VAZIA (provável instabilidade da API), não alerta.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listWorkspaceAccounts } from "@/lib/profiles";
import { sendEmail } from "@/lib/email";
import { connectionLostEmail } from "@/lib/email-templates";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type Conta = { on?: boolean; accountId?: string };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ZERNIO_API_KEY) return NextResponse.json({ ok: true, skipped: "no zernio key" });

  const workspaces = await prisma.workspace.findMany({
    include: {
      envConfig: { select: { contas: true } },
      memberships: { where: { role: "owner" }, include: { user: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  let alertas = 0;
  for (const ws of workspaces) {
    const contasRaw = (ws.envConfig?.contas ?? {}) as Record<string, Conta>;
    const esperadas = Object.entries(contasRaw).filter(([, v]) => v?.on && v?.accountId);
    if (!esperadas.length) continue;

    let live;
    try {
      live = await listWorkspaceAccounts(ws);
    } catch {
      continue; // falha de API → não alerta (evita falso positivo)
    }
    if (!live.length) continue; // lista vazia = provável instabilidade, não N desconexões
    const liveIds = new Set(live.map((a) => a._id));

    const ownerEmail = ws.memberships[0]?.user.email;
    const ownerNome = ws.memberships[0]?.user.nome || undefined;

    for (const [redeId, v] of esperadas) {
      const accountId = v.accountId as string;
      const evWhere = { workspaceId: ws.id, type: "connection.lost", target: accountId };

      if (liveIds.has(accountId)) {
        // reconectada/OK → limpa a trava pra permitir novo alerta numa próxima queda
        await prisma.event.deleteMany({ where: evWhere }).catch(() => {});
        continue;
      }

      // caiu: só alerta se ainda não avisamos por essa conta
      const jaAvisou = await prisma.event.findFirst({ where: evWhere });
      if (jaAvisou) continue;
      if (!ownerEmail) continue;

      const t = connectionLostEmail({ canal: cap(redeId), nome: ownerNome });
      const ok = await sendEmail({ to: ownerEmail, subject: t.subject, html: t.html });
      if (ok) {
        await logEvent(ws.id, "connection.lost", accountId, { rede: redeId });
        alertas++;
      }
    }
  }

  return NextResponse.json({ ok: true, workspaces: workspaces.length, alertas });
}
