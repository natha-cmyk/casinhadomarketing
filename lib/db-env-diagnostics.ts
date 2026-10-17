// Metadados de DATABASE_URL / DIRECT_URL + ping Prisma — sem senhas nos retornos.
import { prisma } from "@/lib/prisma";

export type DbUrlSnapshot = {
  configured: boolean;
  host: string | null;
  port: string | null;
  user: string | null;
  database: string | null;
  pgbouncer: boolean;
};

export type DbEnvReport = {
  databaseUrl: DbUrlSnapshot;
  directUrl: DbUrlSnapshot;
  issues: string[];
  vercelEnv: string | null;
};

function parsePostgresUrl(raw: string | undefined): DbUrlSnapshot {
  const empty: DbUrlSnapshot = {
    configured: false,
    host: null,
    port: null,
    user: null,
    database: null,
    pgbouncer: false,
  };
  const s = raw?.trim() || "";
  if (!/^postgres(ql)?:\/\//.test(s)) return empty;
  try {
    const u = new URL(s.replace(/^postgresql:/, "http:").replace(/^postgres:/, "http:"));
    return {
      configured: true,
      host: u.hostname || null,
      port: u.port || "5432",
      user: u.username ? decodeURIComponent(u.username) : null,
      database: u.pathname?.replace(/^\//, "") || null,
      pgbouncer: u.searchParams.get("pgbouncer") === "true",
    };
  } catch {
    return empty;
  }
}

/** Regras alinhadas a `scripts/assert-db-env.mjs` + erros comuns no staging. */
export function describeDbEnv(): DbEnvReport {
  const databaseUrl = parsePostgresUrl(process.env.DATABASE_URL);
  const directUrl = parsePostgresUrl(process.env.DIRECT_URL);
  const issues: string[] = [];

  if (!databaseUrl.configured) issues.push("DATABASE_URL ausente ou sem protocolo postgresql://");
  if (!directUrl.configured) issues.push("DIRECT_URL ausente ou sem protocolo postgresql://");

  if (databaseUrl.port === "6542") {
    issues.push("DATABASE_URL na porta 6542 — use 6543 (Transaction pooler do Supabase).");
  }
  if (databaseUrl.configured && databaseUrl.port === "5432" && !databaseUrl.pgbouncer) {
    issues.push(
      "DATABASE_URL na 5432 sem ?pgbouncer=true — na Vercel prefira Transaction pooler na 6543.",
    );
  }
  if (databaseUrl.configured && databaseUrl.port === "6543" && !databaseUrl.pgbouncer) {
    issues.push("DATABASE_URL na 6543 deve incluir ?pgbouncer=true no final.");
  }
  if (
    databaseUrl.host?.startsWith("db.") &&
    databaseUrl.host.endsWith(".supabase.co") &&
    databaseUrl.port === "6543"
  ) {
    issues.push(
      "DATABASE_URL usa db.*.supabase.co:6543 — na Vercel costuma falhar (Can't reach database server). Copie no Supabase Connect → Prisma → Transaction pooler (host *.pooler.supabase.com:6543).",
    );
  }

  if (
    directUrl.host?.startsWith("db.") &&
    directUrl.host.endsWith(".supabase.co") &&
    directUrl.port === "5432"
  ) {
    issues.push(
      "DIRECT_URL usa db.*.supabase.co:5432 — migrate/CI costuma dar P1001; prefira Session pooler (*.pooler.supabase.com:5432).",
    );
  }

  return {
    databaseUrl,
    directUrl,
    issues,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  };
}

export async function pingDatabase(): Promise<{ ok: boolean; ms: number; code: string | null; message: string }> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - t0, code: null, message: "ok" };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const message = err.message?.split("\n")[0] ?? String(e);
    return {
      ok: false,
      ms: Date.now() - t0,
      code: err.code ?? null,
      message: message.slice(0, 280),
    };
  }
}

export function isPreviewDiagnosticsEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
}
