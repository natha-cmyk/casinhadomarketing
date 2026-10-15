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
};

const emptySchema = {
  hasRoleEnum: false,
  hasUserTable: false,
  hasHeadSchemaMarker: false,
};

const ALL = ["0_init", "20260813_crm", "20261007_concorrencia_custom"];

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
    expect(planReconcileActions(rows, fullSchema, ALL)).toEqual([
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
    ]);
  });

  it("baseline completo quando há schema no head mas histórico vazio", () => {
    expect(planReconcileActions([], fullSchema, ALL)).toEqual([
      { kind: "baseline_all", migrations: ALL },
    ]);
  });

  it("marca só 0_init se schema parcial (sem marcador do head)", () => {
    expect(
      planReconcileActions(
        [],
        { hasRoleEnum: true, hasUserTable: true, hasHeadSchemaMarker: false },
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
});
