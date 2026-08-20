// GET /api/zernio/connect?platform=instagram
// Retorna a authUrl do OAuth hospedado da Zernio para o profile do workspace.
import { NextResponse } from "next/server";
import { getActiveWorkspace } from "@/lib/auth";
import { connectUrl, connectAdsUrl } from "@/lib/zernio";
import { ensurePrimaryProfile, targetProfileForConnect } from "@/lib/profiles";
import { logEvent } from "@/lib/events";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const platform = url.searchParams.get("platform");
    const isAds = url.searchParams.get("ads") === "1";
    if (!platform) return NextResponse.json({ error: "platform ausente" }, { status: 400 });

    const ws = await getActiveWorkspace();
    if (!ws) return NextResponse.json({ error: "unauth" }, { status: 401 });

    // MULTI-PROFILE: pra social, escolhe um profile livre pra essa rede (ou cria um novo
    // → 2ª conta da mesma rede vira multi-conta em vez de substituir). Ads fica no primário.
    const profileId = isAds ? await ensurePrimaryProfile(ws) : await targetProfileForConnect(ws, platform);
    void logEvent(ws.id, "channel.connect", platform, { ads: isAds });

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
