import { describe, expect, it } from "vitest";
import {
  AccessAdminTargetError,
  AccessGrantForbiddenError,
  assertActorCanPatchUser,
  collectPatchOperationKeys,
  forbiddenGrantKeys,
  grantGuardErrorResponse,
  isAdminActor
} from "../src/modules/access/access-grant-guard";
import { buildAccessOperationsTree, structuredCatalogByKey } from "../src/modules/access/access-operations-tree";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";

describe("access grant guard — collectPatchOperationKeys", () => {
  it("merge: allow/deny/remove/delegation kalitlari yig'iladi, access.grant.* olib tashlanadi", () => {
    const keys = collectPatchOperationKeys(
      {
        merge_permissions: true,
        permissions: ["orders.zakaz.view", "access.grant.orders.zakaz.view"],
        denied_permissions: ["clients.klient.delete"],
        remove_permission_keys: ["cash.kassa.view"],
        grant_delegation_allow: ["warehouse.sklady.view"]
      },
      new Map()
    );
    expect(keys.sort()).toEqual(
      ["cash.kassa.view", "clients.klient.delete", "orders.zakaz.view", "warehouse.sklady.view"].sort()
    );
  });

  it("replace: faqat o'zgargan va olib tashlangan kalitlar", () => {
    const current = new Map<string, "allow" | "deny">([
      ["orders.zakaz.view", "allow"],
      ["clients.klient.view", "allow"],
      ["cash.kassa.view", "deny"]
    ]);
    const keys = collectPatchOperationKeys(
      { merge_permissions: false, permissions: ["orders.zakaz.view", "cash.kassa.view"], denied_permissions: [] },
      current
    );
    expect(keys.sort()).toEqual(["cash.kassa.view", "clients.klient.view"]);
  });

  it("bo'sh tana — hech narsa", () => {
    expect(collectPatchOperationKeys({ role: "agent" }, new Map())).toEqual([]);
  });
});

describe("access grant guard — forbidden / admin", () => {
  it("forbiddenGrantKeys: bera olmaydiganlari, takrorsiz va tartiblangan", () => {
    const grantable = new Set(["orders.zakaz.view"]);
    expect(forbiddenGrantKeys(["b.x.view", "orders.zakaz.view", "a.x.view", "b.x.view"], grantable)).toEqual([
      "a.x.view",
      "b.x.view"
    ]);
  });

  it("isAdminActor", () => {
    expect(isAdminActor({ userId: 1, role: "admin" })).toBe(true);
    expect(isAdminActor({ userId: 1, role: "operator" })).toBe(false);
    expect(isAdminActor({ userId: 1, role: null })).toBe(false);
  });

  it("admin bo'lmagan actor admin foydalanuvchiga tega olmaydi (DBsiz)", async () => {
    await expect(
      assertActorCanPatchUser(1, { userId: 5, role: "operator" }, { id: 9, role: "admin" }, { is_active: false } as never)
    ).rejects.toBeInstanceOf(AccessAdminTargetError);
    await expect(
      assertActorCanPatchUser(1, { userId: 5, role: "operator" }, { id: 9, role: "agent" }, { role: "admin" })
    ).rejects.toBeInstanceOf(AccessAdminTargetError);
  });

  it("admin actor — tekshiruvsiz", async () => {
    await expect(
      assertActorCanPatchUser(1, { userId: 1, role: "admin" }, { id: 9, role: "admin" }, { permissions: ["x.y.view"] })
    ).resolves.toBeUndefined();
  });

  it("grantGuardErrorResponse — ruscha xabar va kalitlar", () => {
    const res = grantGuardErrorResponse(new AccessGrantForbiddenError(["orders.zakaz.view"]));
    expect(res?.code).toBe("ACCESS_GRANT_FORBIDDEN");
    expect(res?.message).toContain("Список и просмотр заказов");
    expect(res?.keys).toEqual(["orders.zakaz.view"]);
    expect(grantGuardErrorResponse(new Error("x"))).toBeNull();
  });
});

describe("operations tree", () => {
  it("katalogdagi har bir kalit daraxtda aynan bir marta", () => {
    const tree = buildAccessOperationsTree();
    const keys = tree.flatMap((m) => m.sections.flatMap((s) => s.operations.map((o) => o.key)));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(buildStructuredPermissionCatalog().length);
    expect(structuredCatalogByKey().size).toBe(keys.length);
  });

  it("har bir operatsiyaning ruscha nomi bor, bo'sh bo'lim yo'q", () => {
    for (const m of buildAccessOperationsTree()) {
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.sections.length).toBeGreaterThan(0);
      for (const s of m.sections) {
        expect(s.operations.length).toBeGreaterThan(0);
        for (const o of s.operations) expect(o.label).toMatch(/[А-Яа-яЁё]/);
      }
    }
  });

  it("Зарплата guruhi bitta modulda yig'iladi", () => {
    const payroll = buildAccessOperationsTree().find((m) => m.label === "Зарплата");
    expect(payroll?.sections.map((s) => s.id)).toContain("staff.zarplaty");
    expect(payroll?.sections.map((s) => s.id)).toContain("cash.vydacha_zarplaty");
  });
});
