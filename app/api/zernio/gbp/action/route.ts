// POST /api/zernio/gbp/action
// Ações de ESCRITA do Google Business (Perfil da Empresa) para a conta googlebusiness do workspace.
//   { action:"setLocation", accountId?, locationId }  → PUT gmb-locations (troca a ficha SINCRONIZADA;
//       depois disso os GETs de analytics passam a refletir essa ficha).
//   { action:"reply", accountId?, reviewId, comment } → POST .../reply (resposta do dono à avaliação,
//       escrita pelo USUÁRIO — nada automático).
// Se accountId não vier, resolve a conta googlebusiness pelo profile do workspace.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { gbpSetLocation, gbpReplyReview } from "@/lib/zernio";
import { listWorkspaceAccounts } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      accountId?: string;
      locationId?: string;
      reviewId?: string;
      comment?: string;
    };
    const action = body.action;

    // resolve a conta googlebusiness do profile do workspace, se não veio explícita
    let accountId = body.accountId;
    if (!accountId) {
      if (!ws.zernioProfileId) return NextResponse.json({ error: "sem profile" }, { status: 400 });
      const accounts = await listWorkspaceAccounts(ws).catch(() => []); // agrega profiles (multi-conta)
      accountId = accounts.find((a) => a.platform === "googlebusiness")?._id;
      if (!accountId) return NextResponse.json({ error: "conta googlebusiness não encontrada" }, { status: 404 });
    }

    if (action === "setLocation") {
      const locationId = body.locationId?.trim();
      if (!locationId) return NextResponse.json({ error: "Selecione uma ficha para sincronizar." }, { status: 400 });
      const r = await gbpSetLocation(accountId, locationId);
      return NextResponse.json({ ok: true, selectedLocationId: r.selectedLocationId ?? locationId });
    }

    if (action === "reply") {
      const reviewId = body.reviewId?.trim();
      const comment = body.comment?.trim();
      if (!reviewId) return NextResponse.json({ error: "Avaliação não identificada." }, { status: 400 });
      if (!comment) return NextResponse.json({ error: "Escreva uma resposta antes de enviar." }, { status: 400 });
      const r = await gbpReplyReview(accountId, reviewId, comment);
      return NextResponse.json({ ok: true, reviewId: r.reviewId ?? reviewId, comment });
    }

    return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  } catch (e) {
    // erros amigáveis a partir do corpo da Zernio (o client lança `Zernio <status>: <corpo>`)
    const msg = String(e);
    const status = /Zernio 403/.test(msg) ? 403 : /Zernio 4\d\d/.test(msg) ? 400 : 502;
    const friendly =
      status === 403
        ? "Sem permissão para esta ação na conta do Google conectada."
        : status === 400
        ? "Não foi possível concluir a ação (dados inválidos ou avaliação indisponível)."
        : "Falha ao falar com o Google Business. Tente novamente em instantes.";
    return NextResponse.json({ error: friendly }, { status });
  }
}
