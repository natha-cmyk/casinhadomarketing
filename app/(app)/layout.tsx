import type { ReactNode } from "react";
import { Shell } from "@/components/shell/Shell";

// Layout das telas autenticadas: envolve tudo no Shell (sidebar/toolbar/agente).
// A proteção de sessão é feita no middleware.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
