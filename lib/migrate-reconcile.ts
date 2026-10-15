/**
 * Plano de reconciliação do histórico Prisma vs schema Postgres já existente.
 * Usado por `scripts/migrate-reconcile.mjs` antes de `prisma migrate deploy` (CI e local).
 */

export const LEGACY_INIT_MIGRATION = "20260807180759_init";
export const SQUASHED_INIT_MIGRATION = "0_init";

/** Atualizar ao publicar migration que define o novo “head” do schema (ver docs/migrations.md). */
export const HEAD_SCHEMA_MARKER = {
  table: "EnvConfig",
  column: "concCategorias",
} as const;

export type MigrationRow = {
  migration_name: string;
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

export type SchemaSnapshot = {
  hasRoleEnum: boolean;
  hasUserTable: boolean;
  /** Coluna da migration mais recente conhecida — schema “no head” do repo. */
  hasHeadSchemaMarker: boolean;
};

export type ReconcileAction =
  | { kind: "resolve"; flag: "rolled-back" | "applied"; migration: string }
  | { kind: "baseline_all"; migrations: string[] };

function isApplied(row: MigrationRow): boolean {
  return row.finished_at != null;
}

function isFailed(row: MigrationRow): boolean {
  return row.finished_at == null && row.rolled_back_at == null;
}

export function sortMigrationNames(names: string[]): string[] {
  return [...names].filter((n) => n !== "migration_lock.toml").sort();
}

/**
 * Gera ações em ordem. O executor deve reaplicar o plano após cada `resolve`
 * se quiser estado fresco; este plano assume um snapshot único (suficiente para o CI).
 */
export function planReconcileActions(
  rows: MigrationRow[],
  schema: SchemaSnapshot,
  allMigrationNames: string[],
): ReconcileAction[] {
  const actions: ReconcileAction[] = [];
  const sorted = sortMigrationNames(allMigrationNames);
  const byName = new Map(rows.map((r) => [r.migration_name, r]));

  const appliedNames = new Set(
    rows.filter(isApplied).map((r) => r.migration_name),
  );
  const squashedApplied = appliedNames.has(SQUASHED_INIT_MIGRATION);
  const legacyApplied = appliedNames.has(LEGACY_INIT_MIGRATION);
  const failedSquashed = byName.get(SQUASHED_INIT_MIGRATION);
  const squashedFailed = failedSquashed ? isFailed(failedSquashed) : false;

  if (squashedFailed && schema.hasRoleEnum) {
    actions.push({
      kind: "resolve",
      flag: "rolled-back",
      migration: SQUASHED_INIT_MIGRATION,
    });
    actions.push({
      kind: "resolve",
      flag: "applied",
      migration: SQUASHED_INIT_MIGRATION,
    });
    appliedNames.add(SQUASHED_INIT_MIGRATION);
  }

  if (
    !appliedNames.has(SQUASHED_INIT_MIGRATION) &&
    schema.hasRoleEnum &&
    (legacyApplied || appliedNames.size > 0)
  ) {
    actions.push({
      kind: "resolve",
      flag: "applied",
      migration: SQUASHED_INIT_MIGRATION,
    });
    appliedNames.add(SQUASHED_INIT_MIGRATION);
  }

  if (
    appliedNames.size === 0 &&
    schema.hasRoleEnum &&
    schema.hasUserTable &&
    !schema.hasHeadSchemaMarker
  ) {
    actions.push({
      kind: "resolve",
      flag: "applied",
      migration: SQUASHED_INIT_MIGRATION,
    });
    appliedNames.add(SQUASHED_INIT_MIGRATION);
  }

  const nothingApplied = appliedNames.size === 0;
  if (
    nothingApplied &&
    schema.hasRoleEnum &&
    schema.hasUserTable &&
    schema.hasHeadSchemaMarker &&
    sorted.length > 0
  ) {
    actions.push({ kind: "baseline_all", migrations: sorted });
    return actions;
  }

  return actions;
}
