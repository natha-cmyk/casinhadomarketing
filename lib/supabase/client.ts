import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON } from "./env";

// Cliente Supabase no browser (login/cadastro/logout).
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}
