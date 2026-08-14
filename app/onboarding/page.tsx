// /onboarding — 1º acesso. Gate: precisa de sessão; se já onboarded, volta pro painel.
// Pré-preenche do Perfil existente + detecta as redes conectadas (@) pra mostrar ao usuário.
import { redirect } from "next/navigation";
import { getActiveWorkspace, getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listAccounts } from "@/lib/zernio";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bem-vindo · Casinha do Marketing" };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export default async function OnboardingPage() {
  const [ws, user] = await Promise.all([getActiveWorkspace(), getSessionUser()]);
  if (!ws) redirect("/");
  if (ws.onboarded) redirect("/");

  const perfil = await prisma.perfil.findUnique({ where: { workspaceId: ws.id } }).catch(() => null);

  // redes detectadas (@) — best-effort, não trava o onboarding
  let redes: string[] = [];
  if (ws.zernioProfileId) {
    const r = await withTimeout(listAccounts(ws.zernioProfileId), 3500);
    redes = (r?.accounts || [])
      .filter((a) => a.enabled !== false)
      .map((a) => `${a.username ? "@" + a.username : a.displayName || a.platform} · ${a.platform}`);
  }

  const initial = {
    empresa: perfil?.empresa || ws.nome || "",
    telefone: perfil?.telefone || "",
    emailContato: perfil?.emailContato || user?.email || "",
    ramo: perfil?.ramo || perfil?.segmento || "",
    cidade: perfil?.cidade || "",
    estado: perfil?.estado || "",
    site: perfil?.site || "",
  };

  return <OnboardingForm initial={initial} redes={redes} />;
}
