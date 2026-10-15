// Reconcilia histórico Prisma com schema já existente (squash 0_init, P3018, CI staging).
// Roda antes de `prisma migrate deploy` — ver docs/migrations.md
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  HEAD_SCHEMA_MARKER,
  LEGACY_INIT_MIGRATION,
  planReconcileActions,
  sortMigrationNames,
} from "../lib/migrate-reconcile";

function runResolve(flag: "rolled-back" | "applied", migration: string) {
  execSync(`npx prisma migrate resolve --${flag} "${migration}"`, {
    stdio: "inherit",
    env: process.env,
  });
}

function listMigrationsFromDisk() {
  return sortMigrationNames(readdirSync("prisma/migrations"));
}

async function loadMigrationRows(prisma: PrismaClient) {
  try {
    return await prisma.$queryRaw<
      {
        migration_name: string;
        finished_at: Date | null;
        rolled_back_at: Date | null;
      }[]
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY started_at
    `;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('relation "_prisma_migrations" does not exist')) {
      return [];
    }
    throw e;
  }
}

async function loadSchemaSnapshot(prisma: PrismaClient) {
  const [roleRow, userRow, headRow, crmRow] = await Promise.all([
    prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') AS "exists"
    `,
    prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'User'
      ) AS "exists"
    `,
    prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS "exists"`,
      HEAD_SCHEMA_MARKER.table,
      HEAD_SCHEMA_MARKER.column,
    ),
    prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'CrmConfig'
      ) AS "exists"
    `,
  ]);

  return {
    hasRoleEnum: roleRow[0]?.exists === true,
    hasUserTable: userRow[0]?.exists === true,
    hasHeadSchemaMarker: headRow[0]?.exists === true,
    hasCrmConfigTable: crmRow[0]?.exists === true,
  };
}

async function removePhantomFailedInit(prisma: PrismaClient) {
  const n = await prisma.$executeRawUnsafe(
    `DELETE FROM "_prisma_migrations"
     WHERE migration_name = $1 AND finished_at IS NULL`,
    LEGACY_INIT_MIGRATION,
  );
  if (n > 0) {
    console.log(
      `[migrate-reconcile] linha falha fantasma removida (${LEGACY_INIT_MIGRATION}): ${n}`,
    );
  }
}

async function executeActions(
  actions: ReturnType<typeof planReconcileActions>,
) {
  for (const action of actions) {
    if (action.kind === "resolve") {
      console.log(
        `[migrate-reconcile] prisma migrate resolve --${action.flag} ${action.migration}`,
      );
      runResolve(action.flag, action.migration);
      continue;
    }
    if (action.kind === "baseline_all") {
      console.log(
        `[migrate-reconcile] baseline: ${action.migrations.length} migrações já refletidas no schema`,
      );
      for (const name of action.migrations) {
        runResolve("applied", name);
      }
    }
  }
}

async function main() {
  const prisma = new PrismaClient();
  const allOnDisk = listMigrationsFromDisk();

  try {
    await removePhantomFailedInit(prisma);

    let rows = await loadMigrationRows(prisma);
    let schema = await loadSchemaSnapshot(prisma);
    let actions = planReconcileActions(rows, schema, allOnDisk);

    if (actions.length === 0) {
      console.log("[migrate-reconcile] nada a reconciliar");
      return;
    }

    await executeActions(actions);

    rows = await loadMigrationRows(prisma);
    schema = await loadSchemaSnapshot(prisma);
    actions = planReconcileActions(rows, schema, allOnDisk);
    if (actions.length > 0) {
      await executeActions(actions);
    }
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error("[migrate-reconcile] falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
