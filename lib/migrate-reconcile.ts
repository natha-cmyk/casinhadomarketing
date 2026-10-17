/**
 * Plano de reconciliação do histórico Prisma vs schema Postgres já existente.
 * Usado por `scripts/migrate-reconcile.ts` antes de `prisma migrate deploy` (CI e local).
 */

export const LEGACY_INIT_MIGRATION = "20260807180759_init";
export const SQUASHED_INIT_MIGRATION = "0_init";

/** Atualizar ao publicar migration que define o novo “head” do schema (ver docs/migrations.md). */
export const HEAD_SCHEMA_MARKER = {
  table: "EnvConfig",
  column: "concCategorias",
} as const;

/** Migration ↔ objeto no Postgres; se a linha está “aplicada” mas o objeto não existe → drift. */
export type DriftMarker =
  | { migration: string; kind: "table"; table: string }
  | { migration: string; kind: "column"; table: string; column: string };

export const DRIFT_MARKERS: DriftMarker[] = [
  { migration: "20260929_planilha_cell", kind: "table", table: "PlanilhaCell" },
  { migration: "20260930_reports", kind: "table", table: "Report" },
  {
    migration: "20261007_concorrencia_custom",
    kind: "column",
    table: HEAD_SCHEMA_MARKER.table,
    column: HEAD_SCHEMA_MARKER.column,
  },
];

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
  /** Tabela da migration `20260813_crm` — staging antigo sem coluna de head ainda. */
  hasCrmConfigTable: boolean;
};

export type ReconcileAction =
  | { kind: "resolve"; flag: "rolled-back" | "applied"; migration: string }
  | { kind: "baseline_all"; migrations: string[] };

/** Drift: migration “aplicada” no histórico mas SQL não refletido no schema (P3012 se usar resolve --rolled-back). */
export type DriftRepairAction = { kind: "unmark_applied"; migration: string };

/**
 * `migrate resolve` / baseline só alteram `_prisma_migrations` (metadados).
 * Nunca executam DELETE/UPDATE nas tabelas do app.
 */
export type ReconcileOptions = {
  /**
   * Baseline de várias migrações sem falha registrada (ex.: histórico vazio em staging).
   * **Desligado em produção** — ver `MIGRATE_ALLOW_BULK_BASELINE` no CI.
   */
  allowBulkBaseline: boolean;
};

export const DEFAULT_RECONCILE_OPTIONS: ReconcileOptions = {
  allowBulkBaseline: false,
};

function isApplied(row: MigrationRow): boolean {
  return row.finished_at != null;
}

function isFailed(row: MigrationRow): boolean {
  return row.finished_at == null && row.rolled_back_at == null;
}

export function sortMigrationNames(names: string[]): string[] {
  return [...names].filter((n) => n !== "migration_lock.toml").sort();
}

/** Schema já reflete app em uso; histórico Prisma pode estar incompleto (staging legado). */
export function schemaNeedsRetroactiveCatchUp(schema: SchemaSnapshot): boolean {
  if (schema.hasHeadSchemaMarker) return true;
  return (
    schema.hasRoleEnum &&
    schema.hasUserTable &&
    schema.hasCrmConfigTable
  );
}

function projectedApplied(
  rows: MigrationRow[],
  actions: ReconcileAction[],
): Set<string> {
  const applied = new Set(
    rows.filter(isApplied).map((r) => r.migration_name),
  );
  for (const action of actions) {
    if (action.kind === "resolve" && action.flag === "applied") {
      applied.add(action.migration);
    }
    if (action.kind === "baseline_all") {
      for (const name of action.migrations) applied.add(name);
    }
  }
  return applied;
}

function hasRolledBack(actions: ReconcileAction[], migration: string): boolean {
  return actions.some(
    (a) =>
      a.kind === "resolve" &&
      a.flag === "rolled-back" &&
      a.migration === migration,
  );
}

/**
 * Gera ações em ordem. O executor deve reaplicar o plano após cada `resolve`
 * se quiser estado fresco; este plano assume um snapshot único (suficiente para o CI).
 */
export function planReconcileActions(
  rows: MigrationRow[],
  schema: SchemaSnapshot,
  allMigrationNames: string[],
  options: ReconcileOptions = DEFAULT_RECONCILE_OPTIONS,
): ReconcileAction[] {
  const actions: ReconcileAction[] = [];
  const sorted = sortMigrationNames(allMigrationNames);
  const byName = new Map(rows.map((r) => [r.migration_name, r]));
  const failedRows = rows.filter(isFailed);

  const appliedNames = new Set(
    rows.filter(isApplied).map((r) => r.migration_name),
  );
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

  // P3009: sempre limpar migrações falhas antes do deploy
  for (const row of failedRows) {
    if (!hasRolledBack(actions, row.migration_name)) {
      actions.push({
        kind: "resolve",
        flag: "rolled-back",
        migration: row.migration_name,
      });
    }
  }

  if (schemaNeedsRetroactiveCatchUp(schema)) {
    const applied = projectedApplied(rows, actions);
    const missing = sorted.filter((m) => !applied.has(m));
    const latest = sorted[sorted.length - 1];
    const onlyNewHeadPending =
      missing.length === 1 &&
      missing[0] === latest &&
      applied.size >= sorted.length - 1;

    if (missing.length > 0 && !onlyNewHeadPending) {
      // Baseline só quando o schema já está no head — senão o deploy deve rodar o SQL de verdade.
      const shouldCatchUp =
        schema.hasHeadSchemaMarker &&
        (failedRows.length > 0 ||
          (options.allowBulkBaseline && missing.length >= 2));
      if (shouldCatchUp) {
        actions.push({ kind: "baseline_all", migrations: missing });
      }
    }
  }

  return actions;
}

/**
 * Histórico diz “aplicada”, mas tabela/coluna da migration não existe (baseline indevido).
 * Marca rolled-back para `migrate deploy` reexecutar o `.sql`.
 */
export function planDriftRepair(
  rows: MigrationRow[],
  markerPresent: boolean[],
): DriftRepairAction[] {
  const actions: DriftRepairAction[] = [];
  for (let i = 0; i < DRIFT_MARKERS.length; i++) {
    if (markerPresent[i]) continue;
    const { migration } = DRIFT_MARKERS[i];
    const row = rows.find((r) => r.migration_name === migration);
    if (row && isApplied(row)) {
      actions.push({ kind: "unmark_applied", migration });
    }
  }
  return actions;
}
