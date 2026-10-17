// Reconcilia histórico Prisma com schema já existente (squash 0_init, P3018, CI staging).
// Roda antes de `prisma migrate deploy` — ver docs/migrations.md
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  DRIFT_MARKERS,
  HEAD_SCHEMA_MARKER,
  LEGACY_INIT_MIGRATION,
  planDriftRepair,
  planReconcileActions,
  sortMigrationNames,
  type ReconcileOptions,
} from "../lib/migrate-reconcile";

function reconcileOptionsFromEnv(): ReconcileOptions {
  const allow =
    process.env.MIGRATE_ALLOW_BULK_BASELINE === "1" ||
    process.env.MIGRATE_ALLOW_BULK_BASELINE === "true";
  return { allowBulkBaseline: allow };
}

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

async function loadDriftMarkerPresence(prisma: PrismaClient): Promise<boolean[]> {
  const checks = await Promise.all(
    DRIFT_MARKERS.map((marker) => {
      if (marker.kind === "table") {
        return prisma.$queryRawUnsafe<{ exists: boolean }[]>(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
          ) AS "exists"`,
          marker.table,
        );
      }
      return prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS "exists"`,
        marker.table,
        marker.column,
      );
    }),
  );
  return checks.map((rows) => rows[0]?.exists === true);
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

async function unmarkAppliedMigration(prisma: PrismaClient, migration: string) {
  const allowed = new Set(DRIFT_MARKERS.map((m) => m.migration));
  if (!allowed.has(migration)) {
    throw new Error(`[migrate-reconcile] unmark bloqueado: ${migration}`);
  }
  const n = await prisma.$executeRawUnsafe(
    `DELETE FROM "_prisma_migrations" WHERE migration_name = $1`,
    migration,
  );
  console.log(
    `[migrate-reconcile] drift: removida entrada aplicada de ${migration} (${n} linha(s)) — migrate deploy reaplica`,
  );
}

async function runDriftRepair(prisma: PrismaClient) {
  const rows = await loadMigrationRows(prisma);
  const driftPresent = await loadDriftMarkerPresence(prisma);
  const driftActions = planDriftRepair(rows, driftPresent);
  if (driftActions.length === 0) return;
  console.log(
    `[migrate-reconcile] drift: ${driftActions.length} migração(ões) sem objeto no schema`,
  );
  for (const action of driftActions) {
    await unmarkAppliedMigration(prisma, action.migration);
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
  const options = reconcileOptionsFromEnv();

  if (options.allowBulkBaseline) {
    console.log("[migrate-reconcile] baseline em massa permitido (staging / opt-in)");
  } else {
    console.log(
      "[migrate-reconcile] produção: só metadados; baseline em massa desligado",
    );
  }

  try {
    await removePhantomFailedInit(prisma);

    let rows = await loadMigrationRows(prisma);
    let schema = await loadSchemaSnapshot(prisma);
    let actions = planReconcileActions(rows, schema, allOnDisk, options);

    if (actions.length === 0) {
      console.log("[migrate-reconcile] nada a reconciliar");
    } else {
      await executeActions(actions);

      rows = await loadMigrationRows(prisma);
      schema = await loadSchemaSnapshot(prisma);
      actions = planReconcileActions(rows, schema, allOnDisk, options);
      if (actions.length > 0) {
        await executeActions(actions);
      }
    }

    await runDriftRepair(prisma);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((e) => {
  console.error("[migrate-reconcile] falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
});
