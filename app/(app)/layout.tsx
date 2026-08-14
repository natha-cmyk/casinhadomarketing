import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell/Shell";
import { getActiveWorkspace } from "@/lib/auth";

// Layout das telas autenticadas: envolve tudo no Shell (sidebar/toolbar/agente).
// A proteção de sessão é feita no middleware. Aqui, o gate de ONBOARDING: se o workspace
// ainda não passou pelo 1º acesso, manda pra /onboarding antes de entrar no painel.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const ws = await getActiveWorkspace();
  if (ws && !ws.onboarded) redirect("/onboarding");
  return <Shell>{children}</Shell>;
}
