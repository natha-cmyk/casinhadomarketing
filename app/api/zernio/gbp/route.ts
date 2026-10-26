// GET /api/zernio/gbp?accountId=&since=&until=&locationId=
// Painel do Google Business (Perfil da Empresa). Junta numa chamada os endpoints certos
// da Zernio para a ficha ATIVA da conta googlebusiness do workspace:
//   performance (impressões/rotas/cliques + série diária) · search-keywords (termos) ·
//   gmb-locations (todas as fichas p/ o seletor) · gmb-media (fotos) · gmb-reviews (avaliações) ·
//   gmb-location-details (telefone/categoria/Maps).
// Se accountId não vier, resolve a conta googlebusiness pelo profile do workspace.
// NB: analytics/keywords/media/reviews refletem SÓ a ficha selecionada na Zernio (o param
// locationId é ignorado pela API); o seletor mostra as demais fichas como referência.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import {
  gbpPerformance, gbpSearchKeywords, gbpLocations, gbpMedia, gbpReviews, gbpLocationDetails,
} from "@/lib/zernio";
import { findWorkspaceAccount, listWorkspaceAccounts } from "@/lib/profiles";
import { clientError } from "@/lib/route-error";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    const q = new URL(req.url).searchParams;
    let accountId = q.get("accountId") ?? undefined;
    const since = q.get("since") ?? undefined;
    const until = q.get("until") ?? undefined;
    const locationId = q.get("locationId") ?? undefined;

    // conta explícita tem de ser deste workspace; senão resolve a googlebusiness dele
    if (accountId) {
      const owned = await findWorkspaceAccount(ws, accountId);
      if (!owned) return NextResponse.json({ error: "conta não encontrada" }, { status: 404 });
      accountId = owned._id;
    } else {
      if (!ws.zernioProfileId) return NextResponse.json({ error: "sem profile" }, { status: 400 });
      const accounts = await listWorkspaceAccounts(ws).catch(() => []);
      accountId = accounts.find((a) => a.platform === "googlebusiness")?._id;
      if (!accountId) return NextResponse.json({ error: "conta googlebusiness não encontrada" }, { status: 404 });
    }

    const dateOpts = { fromDate: since, toDate: until, locationId };

    const [performance, keywords, locations, media, reviews, details] = await Promise.all([
      gbpPerformance(accountId, dateOpts).catch(() => null),
      gbpSearchKeywords(accountId, { fromDate: since, toDate: until }).catch(() => null),
      gbpLocations(accountId).catch(() => null),
      gbpMedia(accountId).catch(() => null),
      gbpReviews(accountId).catch(() => null),
      gbpLocationDetails(accountId).catch(() => null),
    ]);

    // ficha ativa (a que os dados refletem): a locationId retornada por media/reviews/details
    const activeLocationId =
      media?.locationId || reviews?.locationId || details?.locationId || null;

    return NextResponse.json({
      accountId, activeLocationId, performance, keywords, locations, media, reviews, details,
    });
  } catch (e) {
    return NextResponse.json({ error: clientError("zernio/gbp", e, "Não foi possível carregar o perfil.") }, { status: 502 });
  }
}
