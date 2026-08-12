// Leitura centralizada das envs do Supabase (aceita nomes alternativos).
// Referências LITERAIS a process.env.NEXT_PUBLIC_* para o Next inlinar no cliente.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";
export const supabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_ANON;
