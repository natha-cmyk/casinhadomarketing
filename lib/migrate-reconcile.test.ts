import { describe, expect, it } from "vitest";
import {
  LEGACY_INIT_MIGRATION,
  planReconcileActions,
  SQUASHED_INIT_MIGRATION,
  sortMigrationNames,
} from "./migrate-reconcile";

const fullSchema = {
  hasRoleEnum: true,
  hasUserTable: true,
  hasHeadSchemaMarker: true,
  hasCrmConfigTable: true,
};

const emptySchema = {
  hasRoleEnum: false,
  hasUserTable: false,
  hasHeadSchemaMarker: false,
  hasCrmConfigTable: false,
};

const legacyStagingSchema = {
  hasRoleEnum: true,
  hasUserTable: true,
  hasHeadSchemaMarker: false,
  hasCrmConfigTable: true,
};

const ALL = ["0_init", "20260813_crm", "20261007_concorrencia_custom"];
const stagingOpts = { allowBulkBaseline: true };
const productionOpts = { allowBulkBaseline: false };

describe("sortMigrationNames", () => {
  it("coloca 0_init antes das datadas", () => {
    expect(sortMigrationNames(["20260813_crm", "0_init"])).toEqual([
      "0_init",
      "20260813_crm",
    ]);
  });
});

describe("planReconcileActions", () => {
  it("não faz nada em banco vazio sem schema", () => {
    expect(
      planReconcileActions([], emptySchema, ALL),
    ).toEqual([]);
  });

  it("marca 0_init aplicada quando legado já foi aplicado", () => {
    const rows = [
      {
        migration_name: LEGACY_INIT_MIGRATION,
        finished_at: new Date(),
        rolled_back_at: null,
      },
      {
        migration_name: "20260813_crm",
        finished_at: new Date(),
        rolled_back_at: null,
      },
    ];
    expect(planReconcileActions(rows, fullSchema, ALL)).toEqual([
      {
        kind: "resolve",
        flag: "applied",
        migration: SQUASHED_INIT_MIGRATION,
      },
    ]);
  });

  it("recupera 0_init falha com schema existente (P3018 / Role exists)", () => {
    const rows = [
      {
        migration_name: SQUASHED_INIT_MIGRATION,
        finished_at: null,
        rolled_back_at: null,
      },
    ];
    const schemaAtHead = fullSchema;
    expect(planReconcileActions(rows, schemaAtHead, ALL)).toEqual([
      {
        kind: "resolve",
        flag: "rolled-back",
        migration: SQUASHED_INIT_MIGRATION,
      },
      {
        kind: "resolve",
        flag: "applied",
        migration: SQUASHED_INIT_MIGRATION,
      },
      {
        kind: "baseline_all",
        migrations: ["20260813_crm", "20261007_concorrencia_custom"],
      },
    ]);
  });

  it("baseline completo quando há schema no head mas histórico vazio (staging)", () => {
    expect(planReconcileActions([], fullSchema, ALL, stagingOpts)).toEqual([
      { kind: "baseline_all", migrations: ALL },
    ]);
  });

  it("produção: não faz baseline em massa sem falha registrada", () => {
    expect(planReconcileActions([], fullSchema, ALL, productionOpts)).toEqual(
      [],
    );
  });

  it("baseline migrações pendentes com schema no head e falha no meio (P3018)", () => {
    const rows = [
      {
        migration_name: SQUASHED_INIT_MIGRATION,
        finished_at: new Date(),
        rolled_back_at: null,
      },
      {
        migration_name: "20260813_ads_customind",
        finished_at: new Date(),
        rolled_back_at: null,
      },
      {
        migration_name: "20260813_crm",
        finished_at: null,
        rolled_back_at: null,
      },
    ];
    expect(planReconcileActions(rows, fullSchema, ALL)).toEqual([
      {
        kind: "resolve",
        flag: "rolled-back",
        migration: "20260813_crm",
      },
      {
        kind: "baseline_all",
        migrations: ["20260813_crm", "20261007_concorrencia_custom"],
      },
    ]);
  });

  it("marca só 0_init se schema parcial (sem marcador do head)", () => {
    expect(
      planReconcileActions(
        [],
        {
          hasRoleEnum: true,
          hasUserTable: true,
          hasHeadSchemaMarker: false,
          hasCrmConfigTable: false,
        },
        ALL,
      ),
    ).toEqual([
      {
        kind: "resolve",
        flag: "applied",
        migration: SQUASHED_INIT_MIGRATION,
      },
    ]);
  });

  it("P3009: falha no CRM sem head marker mas com CrmConfig (staging legado)", () => {
    const rows = [
      {
        migration_name: SQUASHED_INIT_MIGRATION,
        finished_at: new Date(),
        rolled_back_at: null,
      },
      {
        migration_name: "20260813_ads_customind",
        finished_at: new Date(),
        rolled_back_at: null,
      },
      {
        migration_name: "20260813_crm",
        finished_at: null,
        rolled_back_at: null,
      },
    ];
    expect(planReconcileActions(rows, legacyStagingSchema, ALL)).toEqual([
      {
        kind: "resolve",
        flag: "rolled-back",
        migration: "20260813_crm",
      },
      {
        kind: "baseline_all",
        migrations: ["20260813_crm", "20261007_concorrencia_custom"],
      },
    ]);
  });
});
