// POST /api/crm/sync — importa tarefas do ClickUp como Leads (provider=clickup).
// Busca a lista configurada, mapeia cada task -> Lead via fieldMap e faz UPSERT por (workspaceId, extId).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspaceId } from "@/lib/auth";

export const dynamic = "force-dynamic";

// custom field do ClickUp -> valor legível (resolve dropdowns/labels via type_config.options)
function readCustomField(cf: ClickUpCustomField): string | null {
  const v = cf?.value;
  if (v == null || v === "") return null;
  const opts = cf?.type_config?.options ?? [];
  if (cf.type === "drop_down") {
    const opt = opts.find((o) => o.orderindex === v || o.id === v);
    return (opt?.name ?? opt?.label ?? String(v)) || null;
  }
  if (cf.type === "labels" && Array.isArray(v)) {
    const names = v.map((id) => {
      const opt = opts.find((o) => o.id === id);
      return opt?.label ?? opt?.name ?? String(id);
    });
    return names.join(", ") || null;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  value?: unknown;
  type_config?: { options?: { id: string; name?: string; label?: string; orderindex?: unknown }[] };
}
interface ClickUpTask {
  id: string;
  name?: string;
  status?: { status?: string; type?: string };
  date_created?: string;
  custom_fields?: ClickUpCustomField[];
}

export async function POST() {
  try {
    const ws = await getActiveWorkspaceId();
    if (!ws) return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });

    const cfg = await prisma.crmConfig.findUnique({ where: { workspaceId: ws } });
    if (!cfg || cfg.provider !== "clickup") {
      return NextResponse.json({ ok: false, error: "CRM não está no modo ClickUp." }, { status: 400 });
    }
    if (!cfg.clickupToken || !cfg.clickupListId) {
      return NextResponse.json({ ok: false, error: "Informe o token e o List ID do ClickUp." }, { status: 400 });
    }

    const url = `https://api.clickup.com/api/v2/list/${encodeURIComponent(cfg.clickupListId)}/task?include_closed=true`;
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
      return NextResponse.json(
        { ok: false, error: `ClickUp respondeu ${res.status}. Verifique o List ID.` },
        { status: 400 }
      );
    }

    const body = (await res.json()) as { tasks?: ClickUpTask[] };
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];

    const fm = (cfg.fieldMap ?? {}) as Record<string, string>;
    const pick = (task: ClickUpTask, leadField: string): string | null => {
      const cfName = fm[leadField];
      if (!cfName) return null;
      const cf = (task.custom_fields ?? []).find(
        (c) => c.name?.toLowerCase() === cfName.toLowerCase()
      );
      return cf ? readCustomField(cf) : null;
    };

    let imported = 0;
    for (const t of tasks) {
      const channel = pick(t, "channel");
      const product = pick(t, "product");
      const lossReason = pick(t, "lossReason");
      const statusMapped = pick(t, "status");
      const status = statusMapped ?? t.status?.status ?? null;
      const valueRaw = pick(t, "value");
      const value = valueRaw != null ? Number(String(valueRaw).replace(/[^0-9.-]/g, "")) || 0 : 0;
      const createdAt = t.date_created ? new Date(Number(t.date_created)) : new Date();

      const data = {
        source: "clickup",
        title: t.name ?? null,
        channel,
        product,
        status,
        stage: t.status?.status ?? null,
        value,
        lossReason,
        createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
        raw: t as unknown as object,
      };

      await prisma.lead.upsert({
        where: { workspaceId_extId: { workspaceId: ws, extId: t.id } },
        create: { workspaceId: ws, extId: t.id, ...data },
        update: data,
      });
      imported++;
    }

    return NextResponse.json({ ok: true, imported });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
