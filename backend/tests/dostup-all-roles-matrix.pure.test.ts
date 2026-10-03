import { describe, expect, it } from "vitest";
import { expandPermissionKeyAliases } from "../src/modules/access/legacy-key-map";
import {
  buildStructuredPermissionCatalog,
  PERMISSION_SECTIONS
} from "../src/modules/access/permission-model";
import { buildRoleDefaultKeys, rolesWithPresets } from "../src/modules/access/role-permission-presets";
import { matchRule } from "../src/modules/access/route-permission-guard";
import {
  actorHasUnrestrictedDataScope,
  buildOrderAgentScopeWhere,
  buildScopedStaffDirectoryWhere,
  resolveAllowedAgentIdsForActor
} from "../src/modules/access/access-staff-scope";

/** Dostup bo‘limlarini qamrab oluvchi API probe’lar (har moduldan). */
const PROBES: Array<{ method: string; path: string; label: string }> = [
  { method: "GET", path: "/api/:slug/orders", label: "buyurtmalar" },
  { method: "POST", path: "/api/:slug/orders", label: "buyurtma yaratish" },
  { method: "GET", path: "/api/:slug/returns", label: "qaytarish" },
  { method: "POST", path: "/api/:slug/returns", label: "qaytarish yaratish" },
  { method: "GET", path: "/api/:slug/refusals", label: "rad etish" },
  { method: "GET", path: "/api/:slug/clients", label: "mijozlar" },
  { method: "POST", path: "/api/:slug/clients", label: "mijoz yaratish" },
  { method: "GET", path: "/api/:slug/clients/1/photo-reports", label: "fotootchet" },
  { method: "GET", path: "/api/:slug/payments", label: "to‘lovlar" },
  { method: "POST", path: "/api/:slug/payments", label: "to‘lov yaratish" },
  { method: "GET", path: "/api/:slug/cash-desks", label: "kassalar" },
  { method: "POST", path: "/api/:slug/cash-desks", label: "kassa yaratish" },
  { method: "GET", path: "/api/:slug/opening-balances", label: "boshlang‘ich balans" },
  { method: "GET", path: "/api/:slug/client-balances", label: "mijoz balanslari" },
  { method: "GET", path: "/api/:slug/expenses", label: "xarajatlar" },
  { method: "GET", path: "/api/:slug/warehouses", label: "omborlar" },
  { method: "POST", path: "/api/:slug/goods-receipts", label: "ombor kirimi" },
  { method: "GET", path: "/api/:slug/warehouse-transfers", label: "ko‘chirish" },
  { method: "GET", path: "/api/:slug/stock/balances", label: "qoldiq" },
  { method: "GET", path: "/api/:slug/suppliers", label: "ta’minotchi" },
  { method: "GET", path: "/api/:slug/products", label: "tovar" },
  { method: "GET", path: "/api/:slug/agents", label: "agentlar" },
  { method: "POST", path: "/api/:slug/agents", label: "agent yaratish" },
  { method: "GET", path: "/api/:slug/expeditors", label: "ekspeditorlar" },
  { method: "GET", path: "/api/:slug/supervisors", label: "supervayzerlar" },
  { method: "GET", path: "/api/:slug/collectors", label: "inkassatorlar" },
  { method: "GET", path: "/api/:slug/auditors", label: "auditorlar" },
  { method: "GET", path: "/api/:slug/skladchik", label: "skladchiklar" },
  { method: "GET", path: "/api/:slug/operators", label: "operatorlar" },
  { method: "GET", path: "/api/:slug/work-slots", label: "ish joyi" },
  { method: "GET", path: "/api/:slug/consignment", label: "konsignatsiya" },
  { method: "GET", path: "/api/:slug/timesheet", label: "tabel" },
  { method: "GET", path: "/api/:slug/dashboard/sales", label: "dashboard savdo" },
  { method: "GET", path: "/api/:slug/dashboard/finance", label: "dashboard moliya" },
  { method: "GET", path: "/api/:slug/dashboard/supervisor", label: "dashboard SVR" },
  { method: "GET", path: "/api/:slug/reports", label: "hisobotlar" },
  { method: "GET", path: "/api/:slug/plans/setup", label: "planlar" },
  { method: "GET", path: "/api/:slug/access/users", label: "dostup" },
  { method: "PATCH", path: "/api/:slug/access/users/1", label: "dostup yozish" },
  { method: "GET", path: "/api/:slug/audit-events", label: "audit" },
  { method: "GET", path: "/api/:slug/activity", label: "aktivlik" },
  { method: "GET", path: "/api/:slug/field/routes", label: "GPS/field" },
  { method: "GET", path: "/api/:slug/bonus-rules", label: "bonus" },
  { method: "GET", path: "/api/:slug/territory", label: "hudud sozlama" },
  { method: "GET", path: "/api/:slug/sales-directions", label: "savdo yo‘nalishi" },
  { method: "GET", path: "/api/:slug/notifications", label: "vazifalar" },
  { method: "GET", path: "/api/:slug/order-automation", label: "avtomatlashtirish" },
  { method: "GET", path: "/api/:slug/error-events", label: "diagnostika" }
];

function applyDeny(keys: Iterable<string>, denied: string[]): Set<string> {
  const effective = new Set(keys);
  for (const k of expandPermissionKeyAliases(denied)) effective.delete(k);
  return effective;
}

function can(keys: Set<string>, method: string, path: string): boolean {
  const rule = matchRule(method, path);
  if (!rule) return true;
  return rule.anyOf.some((k) => keys.has(k));
}

const CATALOG_KEYS = new Set(buildStructuredPermissionCatalog().map((e) => e.key));
const ALL_ROLES = rolesWithPresets();

describe("Dostup — barcha rollar: katalog va dostup yopiq", () => {
  it("har bir preset kaliti katalogda", () => {
    for (const role of ALL_ROLES) {
      for (const key of buildRoleDefaultKeys(role)) {
        if (key === "access.manage" || key === "users.manage" || key === "audit.view") continue;
        expect(CATALOG_KEYS.has(key), `${role} → ${key}`).toBe(true);
      }
    }
  });

  it("admin bo‘lmaganlarda access.manage / access.upravlenie yo‘q", () => {
    for (const role of ALL_ROLES) {
      if (role === "admin") continue;
      const k = buildRoleDefaultKeys(role);
      expect(k, role).not.toContain("access.manage");
      expect(k.some((x) => x.startsWith("access.")), role).toBe(false);
    }
  });

  it("admin katalog + boshqaruv kalitlariga ega", () => {
    const k = new Set(buildRoleDefaultKeys("admin"));
    expect(k.has("access.upravlenie.view")).toBe(true);
    expect(k.has("access.upravlenie.update")).toBe(true);
    expect(k.has("access.manage")).toBe(true);
    expect(can(k, "GET", "/api/:slug/access/users")).toBe(true);
    expect(can(k, "PATCH", "/api/:slug/access/users/1")).toBe(true);
  });

  it("har bir permission section kamida bitta view kalitiga ega", () => {
    const actionOnlySections = new Set(["orders.drugie_operacii"]);
    for (const sec of PERMISSION_SECTIONS) {
      if (actionOnlySections.has(`${sec.module}.${sec.section}`)) continue;
      if (sec.module === "orders" && sec.section.startsWith("status_")) continue;
      if (sec.module === "clients" && sec.section.startsWith("gr_")) continue;
      expect(sec.actions.includes("view"), `${sec.module}.${sec.section}`).toBe(true);
    }
  });
});

describe.each(ALL_ROLES)("Dostup rol «%s» — default + grant + deny", (role) => {
  const preset = buildRoleDefaultKeys(role);
  const base = new Set(preset);

  it("preset bo‘sh emas", () => {
    expect(preset.length).toBeGreaterThan(0);
  });

  it("har bir probe: default → deny yopadi → grant qayta ochadi (yoki grant ochadi → deny yopadi)", () => {
    for (const probe of PROBES) {
      const rule = matchRule(probe.method, probe.path);
      if (!rule) continue;
      const open = can(base, probe.method, probe.path);
      const tag = `${role} ${probe.method} ${probe.label}`;

      if (open) {
        const closed = applyDeny(base, rule.anyOf);
        expect(can(closed, probe.method, probe.path), `${tag} deny`).toBe(false);
        expect(can(base, probe.method, probe.path), `${tag} restore`).toBe(true);
      } else {
        const grantKey = rule.anyOf[0];
        if (!grantKey) continue;
        const granted = new Set(base);
        granted.add(grantKey);
        expect(can(granted, probe.method, probe.path), `${tag} grant ${grantKey}`).toBe(true);
        const afterDeny = applyDeny(granted, [grantKey]);
        expect(can(afterDeny, probe.method, probe.path), `${tag} grant-then-deny`).toBe(false);
      }
    }
  });
});

describe("Dostup ma’lumot doirasi — har bir non-admin rol", () => {
  const scopedRoles = ALL_ROLES.filter((r) => r !== "admin");

  it("biriktirish yo‘q — hodim/savdo bo‘sh (agent o‘zini ko‘radi)", () => {
    for (const role of scopedRoles) {
      const actor = { userId: 42, role, bound_agent_ids: [] as number[], bound_staff_ids: [] as number[] };
      if (role === "agent") {
        expect(resolveAllowedAgentIdsForActor(actor), role).toEqual([42]);
        expect(buildOrderAgentScopeWhere(actor), role).toEqual({ agent_id: 42 });
        expect(buildScopedStaffDirectoryWhere(actor), role).toEqual({ id: 42 });
        continue;
      }
      expect(actorHasUnrestrictedDataScope(role), role).toBe(false);
      expect(resolveAllowedAgentIdsForActor(actor), role).toEqual([]);
      expect(buildOrderAgentScopeWhere(actor), role).toEqual({ agent_id: { in: [] } });
      expect(buildScopedStaffDirectoryWhere(actor), role).toEqual({ id: { in: [] } });
    }
  });

  it("faqat o‘z agentlari — begona agent yopiq", () => {
    for (const role of scopedRoles) {
      if (role === "agent") continue;
      const actor = { userId: 7, role, bound_agent_ids: [10], bound_staff_ids: [10] };
      expect(resolveAllowedAgentIdsForActor(actor), role).toEqual([10]);
      expect(buildOrderAgentScopeWhere(actor), role).toEqual({ agent_id: { in: [10] } });
      expect(buildScopedStaffDirectoryWhere(actor), role).toEqual({ id: { in: [10] } });
    }
  });
});
