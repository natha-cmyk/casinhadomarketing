// Verifica os números do seed sem precisar de banco (roda com tsx).
// `npx tsx scripts/verify-seed.ts`
import {
  LEADS_M, canaisTotalYear, PERSONAS, COMP, OKR2026, REDES, POSTS_SEED,
} from "../lib/seed-data";
import { sum } from "../lib/format";

let fail = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${got}${ok ? "" : ` (esperado ${want})`}`);
}

const leads2026 = sum(LEADS_M[2026]);
check("LEADS_M 2026 YTD", leads2026, 1904);
check("CANAIS 2026 total", canaisTotalYear(2026), 1904);
check("Personas", PERSONAS.length, 5);
const totalComp = (Object.keys(COMP) as (keyof typeof COMP)[]).reduce((a, k) => a + COMP[k].list.length, 0);
check("Concorrentes", totalComp, 24);
check("OKR áreas", OKR2026.areas.length, 4);
check("OKR KRs", OKR2026.areas.reduce((a, x) => a + x.krs.length, 0), 14);
check("REDES (23 canais)", REDES.length, 23);
check("REDES social", REDES.filter((r) => r.grupo === "social").length, 12);
check("REDES conversas", REDES.filter((r) => r.grupo === "conversas").length, 4);
check("REDES ads", REDES.filter((r) => r.grupo === "ads").length, 7);
check("Posts seed", POSTS_SEED.length, 6);

console.log(fail ? `\n${fail} verificação(ões) falharam.` : "\nTodos os números batem. ✅");
process.exit(fail ? 1 : 0);
