// GET /api/zernio/connect?platform=instagram
// Retorna a authUrl do OAuth hospedado da Zernio para o profile do workspace.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveWorkspace } from "@/lib/auth";
import { connectUrl, connectAdsUrl, createProfile } from "@/lib/zernio";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const platform = url.searchParams.get("platform");
    const isAds = url.searchParams.get("ads") === "1";
    if (!platform) return NextResponse.json({ error: "platform ausente" }, { status: 400 });

    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    // garante um profile Zernio para o workspace (cria sob demanda)
    let profileId = ws.zernioProfileId;
    if (!profileId) {
      const p = await createProfile(`${ws.nome} · ${ws.id.slice(0, 6)}`);
      profileId = p.profile._id;
      await prisma.workspace.update({ where: { id: ws.id }, data: { zernioProfileId: profileId } });
    }

    // volta pro nosso app depois do OAuth (cliente nunca vê o dashboard da Zernio)
    const origin = req.headers.get("origin") || url.origin;
    const redirect = `${origin}/conectado`;
    if (isAds) {
      const r = await connectAdsUrl(platform, profileId, redirect);
      return NextResponse.json(r); // { authUrl } ou { alreadyConnected: true }
    }
    const { authUrl } = await connectUrl(platform, profileId, redirect);
    return NextResponse.json({ authUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
