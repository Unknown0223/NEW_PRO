import { describe, expect, it } from "vitest";
import { composeLinkedRoleKeys, extraRoleKeysFromLinks } from "../src/modules/access/access-extra-roles";
import { buildRoleDefaultKeys } from "../src/modules/access/role-permission-presets";
import { matchRule } from "../src/modules/access/route-permission-guard";

function can(keys: Set<string>, method: string, path: string): boolean {
  const rule = matchRule(method, path);
  if (!rule) return true;
  return rule.anyOf.some((k) => keys.has(k));
}

describe("composeLinkedRoleKeys", () => {
  it("asosiy rolni birinchi qoldiradi, dublikat va bo‘shni tashlaydi", () => {
    expect(composeLinkedRoleKeys("cashier", ["skladchik", "cashier", "  ", "skladchik"])).toEqual([
      "cashier",
      "skladchik"
    ]);
  });

  it("admin bo‘lmagan akkauntga extra admin paketini bermaydi", () => {
    expect(composeLinkedRoleKeys("cashier", ["admin", "skladchik"])).toEqual(["cashier", "skladchik"]);
  });

  it("asosiy admin bo‘lsa extra adminni dublikat qilmaydi", () => {
    expect(composeLinkedRoleKeys("admin", ["cashier", "admin"])).toEqual(["admin", "cashier"]);
  });
});

describe("extraRoleKeysFromLinks", () => {
  it("asosiy kalitni chiqarib tashlaydi", () => {
    expect(extraRoleKeysFromLinks("operator", ["operator", "cashier", "skladchik"])).toEqual([
      "cashier",
      "skladchik"
    ]);
  });
});

describe("bir akkaunt — bir nechta rol paketi (union)", () => {
  it("kassir + skladchik: kassa yozish va ombor kirimi ochiladi", () => {
    const keys = new Set([...buildRoleDefaultKeys("cashier"), ...buildRoleDefaultKeys("skladchik")]);
    expect(can(keys, "POST", "/api/:slug/payments")).toBe(true);
    expect(can(keys, "POST", "/api/:slug/goods-receipts")).toBe(true);
    expect(can(keys, "GET", "/api/:slug/access/users")).toBe(false);
  });

  it("operator + supervisor: buyurtma va ish joyi ochiladi, kassa yozish yo‘q", () => {
    const keys = new Set([...buildRoleDefaultKeys("operator"), ...buildRoleDefaultKeys("supervisor")]);
    expect(can(keys, "POST", "/api/:slug/orders")).toBe(true);
    expect(can(keys, "GET", "/api/:slug/work-slots")).toBe(true);
    expect(can(keys, "POST", "/api/:slug/payments")).toBe(false);
  });
});
