// /api/crm/sync — integração ClickUp do funil (leads/oportunidades).
//   POST  → importa/atualiza as tasks como Leads (núcleo em lib/crm-sync). Incremental por
//           padrão; ?full=1 reprocessa tudo.
//   GET   → detecta os campos personalizados da lista (pra o usuário mapear na UI).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";
import { syncClickupLeads } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";

interface ClickUpOption { name?: string; label?: string }
interface ClickUpCustomField { name: string; type: string; type_config?: { options?: ClickUpOption[] } }

// ── GET: detecta campos da lista pra a UI de mapeamento ──
export async function GET() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const cfg = await prisma.crmConfig.findUnique({ where: { workspaceId: ws } });
    if (!cfg || cfg.provider !== "clickup" || !cfg.clickupToken || !cfg.clickupListId) {
      return NextResponse.json({ ok: false, error: "Configure o token e o List ID do ClickUp." }, { status: 400 });
    }

    const url = `https://api.clickup.com/api/v2/list/${encodeURIComponent(cfg.clickupListId)}/field`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { Authorization: cfg.clickupToken }, cache: "no-store" });
    } catch {
      return NextResponse.json({ ok: false, error: "Não foi possível falar com o ClickUp." }, { status: 502 });
    }
    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: "Token do ClickUp inválido ou sem acesso." }, { status: 400 });
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `ClickUp respondeu ${res.status}. Verifique o List ID.` }, { status: 400 });
    }

    const body = (await res.json()) as { fields?: ClickUpCustomField[] };
    const fields = (Array.isArray(body?.fields) ? body.fields : []).map((f) => ({
      name: f.name,
      type: f.type,
      options: (f.type_config?.options ?? []).map((o) => o.name ?? o.label ?? "").filter(Boolean),
    }));

    return NextResponse.json({ ok: true, fields });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// ── POST: importa/atualiza as tasks como leads (incremental; ?full=1 = completo) ──
export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const full = new URL(req.url).searchParams.get("full") === "1";
    const r = await syncClickupLeads(ws, { full });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, imported: r.imported, incremental: r.incremental });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
