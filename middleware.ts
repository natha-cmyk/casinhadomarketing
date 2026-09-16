import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Páginas (renova sessão + protege rota), menos assets estáticos.
    // `/api` FICA DE FORA de propósito: as rotas de API já autenticam sozinhas (getActiveWorkspace),
    // então rodar o middleware nelas só duplicava a checagem de sessão a cada chamada. A renovação de
    // token continua acontecendo nas navegações de página e pelo client de browser.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
