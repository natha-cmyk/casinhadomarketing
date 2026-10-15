// Valida DATABASE_URL / DIRECT_URL antes do migrate (CI e local).
// Não imprime senhas — só host/porta.
function portOf(raw) {
  try {
    const u = new URL(raw.replace(/^postgresql:/, "http:").replace(/^postgres:/, "http:"));
    return u.port || "5432";
  } catch {
    return null;
  }
}

function hostOf(raw) {
  try {
    const u = new URL(raw.replace(/^postgresql:/, "http:").replace(/^postgres:/, "http:"));
    return u.hostname;
  } catch {
    return null;
  }
}

const db = process.env.DATABASE_URL?.trim() || "";
const direct = process.env.DIRECT_URL?.trim() || "";

if (!/^postgres(ql)?:\/\//.test(db)) {
  console.error("[db-env] DATABASE_URL ausente ou sem protocolo postgresql://");
  process.exit(1);
}
if (!/^postgres(ql)?:\/\//.test(direct)) {
  console.error("[db-env] DIRECT_URL ausente ou sem protocolo postgresql://");
  process.exit(1);
}

const dbPort = portOf(db);
const directHost = hostOf(direct);
const directPort = portOf(direct);

if (dbPort === "6542") {
  console.error(
    "[db-env] DATABASE_URL está na porta 6542. No Supabase o pooler Transaction é 6543 (+ ?pgbouncer=true). Corrija o secret."
  );
  process.exit(1);
}

if (dbPort === "5432" && !db.includes("pgbouncer=true")) {
  console.warn(
    "[db-env] Aviso: DATABASE_URL na 5432 sem ?pgbouncer=true — em app serverless prefira pooler 6543."
  );
}

// migrate deploy usa DIRECT_URL; runners do GitHub muitas vezes não alcançam db.*.supabase.co:5432 (P1001).
const directIsSupabaseDbHost =
  directHost?.startsWith("db.") && directHost.endsWith(".supabase.co") && directPort === "5432";

if (process.env.CI && directIsSupabaseDbHost) {
  console.error(
    `[db-env] DIRECT_URL usa host direct (${directHost}:5432). GitHub Actions costuma falhar com P1001.`
  );
  console.error(
    "[db-env] No Supabase: Connect → ORMs → Prisma → copie a URI **Session pooler** (host *pooler.supabase.com*, porta 5432) para DIRECT_URL_STAGING / DIRECT_URL_PRODUCTION."
  );
  console.error(
    "[db-env] DATABASE_URL continua sendo Transaction pooler (6543 + ?pgbouncer=true)."
  );
  process.exit(1);
}

if (directIsSupabaseDbHost) {
  console.warn(
    "[db-env] DIRECT_URL é host db.*.supabase.co — se migrate falhar fora da sua rede, use Session pooler no DIRECT_URL."
  );
}

console.log(`[db-env] ok — DATABASE_URL :${dbPort}, DIRECT_URL ${directHost}:${directPort}`);
