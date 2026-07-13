import { describe, expect, it } from "vitest";
import { ClientImportRefResolver } from "../src/modules/clients/client-import-ref-resolve";
import {
  buildAgentAssignmentPatchesFromImportRow,
  type ImportStaffLookup
} from "../src/modules/clients/clients.import.assign";
import { buildImportUpdateScalarData } from "../src/modules/clients/clients.import.rows-update.build";

function emptyStaffLookup(): ImportStaffLookup {
  return { byId: new Map(), byCode: new Map(), byName: new Map(), byPhone: new Map() };
}

function refResolverWithCategory(codes: Array<{ code: string; name: string }>) {
  const resolver = Object.create(ClientImportRefResolver.prototype) as ClientImportRefResolver;
  Object.assign(resolver, {
    miss: { category: 0, client_type_code: 0, client_format: 0, sales_channel: 0, city: 0 },
    resolveCategory(raw: string | null) {
      if (raw == null || raw.trim() === "") return null;
      const hit = codes.find((c) => c.code === raw.trim() || c.name === raw.trim());
      if (!hit) {
        this.miss.category += 1;
        return null;
      }
      return hit.code;
    },
    resolveClientType: () => null,
    resolveClientFormat: () => null,
    resolveSalesChannel: () => null,
    resolveCity: () => null,
    summarizeMisses: () => []
  });
  return resolver;
}

describe("clients import clear-on-empty", () => {
  it("clears mapped scalar field when Excel cell is empty", () => {
    const refResolver = refResolverWithCategory([{ code: "A", name: "Alpha" }]);
    const row = ["", "old legal"];
    const colIndexByKey = { legal_name: 0, name: 1 };
    const data = buildImportUpdateScalarData(row, colIndexByKey, refResolver, null);
    expect(data.legal_name).toBeNull();
    expect(data.name).toBe("old legal");
  });

  it("returns null for unknown spravochnik code", () => {
    const refResolver = refResolverWithCategory([{ code: "A", name: "Alpha" }]);
    const row = ["UNKNOWN"];
    const colIndexByKey = { category_code: 0 };
    const data = buildImportUpdateScalarData(row, colIndexByKey, refResolver, null);
    expect(data.category).toBeNull();
    expect(refResolver.miss.category).toBe(1);
  });

  it("clears mapped agent and days when cells are empty on update", () => {
    const warnings: string[] = [];
    const row = ["", ""];
    const colIndexByKey = { import_agent_1: 0, import_agent_1_days: 1 };
    const current = [
      {
        slot: 1,
        agent_id: 42,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: [3]
      }
    ];
    const out = buildAgentAssignmentPatchesFromImportRow(
      row,
      colIndexByKey,
      emptyStaffLookup(),
      2,
      (m) => warnings.push(m),
      current
    );
    expect(out.touched).toBe(true);
    expect(out.updatePatches).toEqual([
      {
        slot: 1,
        agent_id: null,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: []
      }
    ]);
    expect(warnings).toHaveLength(0);
  });

  it("clears agent on slot 1 and keeps untouched slot 2", () => {
    const row = ["---"];
    const colIndexByKey = { import_agent_1: 0 };
    const current = [
      {
        slot: 1,
        agent_id: 42,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: [3]
      },
      {
        slot: 2,
        agent_id: 7,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: []
      }
    ];
    const out = buildAgentAssignmentPatchesFromImportRow(
      row,
      colIndexByKey,
      emptyStaffLookup(),
      2,
      () => {},
      current
    );
    expect(out.updatePatches).toEqual([
      {
        slot: 1,
        agent_id: null,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: [3]
      },
      {
        slot: 2,
        agent_id: 7,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: []
      }
    ]);
  });

  it("clears agent when code is unknown", () => {
    const warnings: string[] = [];
    const row = ["NO_SUCH_AGENT"];
    const colIndexByKey = { import_agent_1: 0 };
    const current = [
      {
        slot: 1,
        agent_id: 42,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: []
      }
    ];
    const out = buildAgentAssignmentPatchesFromImportRow(
      row,
      colIndexByKey,
      emptyStaffLookup(),
      2,
      (m) => warnings.push(m),
      current
    );
    expect(out.updatePatches).toEqual([
      {
        slot: 1,
        agent_id: null,
        expeditor_user_id: null,
        expeditor_phone: null,
        visit_weekdays: []
      }
    ]);
    expect(warnings.some((w) => w.includes("olib tashlandi"))).toBe(true);
  });
});
