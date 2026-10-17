import { describe, expect, it } from "vitest";
import {
  accessOpKind,
  buildOperationsDraftPatch,
  draftChangedKeys,
  EMPTY_OPS_FILTER,
  filterAccessTree,
  opMatchesFilter,
  opStateLabel,
  patchForKeys,
  treeKeys,
  triState,
  type AccessOpMatrixState,
  type AccessTreeModule
} from "@/lib/access-operations-tree";
import { summarizeAccessLogNew, summarizeAccessLogOld } from "@/lib/access-history-summary";
import { filterAccessUsers } from "@/components/access/access-users-sidebar";
import type { AccessUserRow } from "@/components/access/access-workspace.shared";

const TREE: AccessTreeModule[] = [
  {
    id: "orders",
    label: "Заказы",
    sections: [
      {
        id: "orders.zakaz",
        label: "Заказы",
        operations: [
          { key: "orders.zakaz.view", action: "view", label: "Список и просмотр заказов" },
          { key: "orders.zakaz.create", action: "create", label: "Создание заказа" }
        ]
      }
    ]
  },
  {
    id: "cash",
    label: "Касса",
    sections: [{ id: "cash.kassa", label: "Кассы", operations: [{ key: "cash.kassa.view", action: "view", label: "Просмотр касс" }] }]
  }
];

const st = (from_role: boolean, user_effect: AccessOpMatrixState["user_effect"], effective: boolean): AccessOpMatrixState => ({
  from_role,
  user_effect,
  effective
});

describe("access operations tree", () => {
  it("treeKeys / triState", () => {
    expect(treeKeys(TREE)).toEqual(["orders.zakaz.view", "orders.zakaz.create", "cash.kassa.view"]);
    const on = new Set(["orders.zakaz.view"]);
    expect(triState(["orders.zakaz.view", "orders.zakaz.create"], (k) => on.has(k))).toBe("some");
    expect(triState(["orders.zakaz.view"], (k) => on.has(k))).toBe("all");
    expect(triState(["cash.kassa.view"], (k) => on.has(k))).toBe("none");
    expect(triState([], () => true)).toBe("none");
  });

  it("filterAccessTree: bo'lim nomi mos — butun bo'lim, aks holda operatsiyalar; ё = е", () => {
    expect(treeKeys(filterAccessTree(TREE, "касс"))).toEqual(["cash.kassa.view"]);
    expect(treeKeys(filterAccessTree(TREE, "создание"))).toEqual(["orders.zakaz.create"]);
    expect(treeKeys(filterAccessTree(TREE, "заказы"))).toEqual(["orders.zakaz.view", "orders.zakaz.create"]);
    expect(treeKeys(filterAccessTree(TREE, "", (op) => op.action === "view"))).toEqual(["orders.zakaz.view", "cash.kassa.view"]);
    expect(filterAccessTree(TREE, "нет такого")).toEqual([]);
  });

  it("accessOpKind", () => {
    expect(accessOpKind("view")).toBe("view");
    expect(accessOpKind("history")).toBe("view");
    expect(accessOpKind("delete")).toBe("action");
  });

  it("opStateLabel — faqat haqiqiy meros", () => {
    expect(opStateLabel(st(true, "none", true))).toBe("Из роли");
    expect(opStateLabel(st(false, "allow", true))).toBe("Лично");
    expect(opStateLabel(st(true, "deny", false))).toBe("Запрещено");
    expect(opStateLabel(st(false, "none", false))).toBe("Не назначено");
    expect(opStateLabel(undefined)).toBe("Не назначено");
  });

  it("buildOperationsDraftPatch: yoqish/o'chirish qoidalari bitta PATCH da", () => {
    const state = new Map<string, AccessOpMatrixState>([
      ["a.role.view", st(true, "none", true)],
      ["b.personal.view", st(false, "allow", true)],
      ["c.denied.view", st(true, "deny", false)],
      ["d.none.view", st(false, "none", false)]
    ]);
    const draft = new Map<string, boolean>([
      ["a.role.view", false],
      ["b.personal.view", false],
      ["c.denied.view", true],
      ["d.none.view", true],
      ["e.missing.view", true]
    ]);
    expect(buildOperationsDraftPatch(state, draft)).toEqual({
      remove_permission_keys: ["b.personal.view", "c.denied.view"],
      merge_permissions: true,
      permissions: ["d.none.view", "e.missing.view"],
      denied_permissions: ["a.role.view"]
    });
    expect(draftChangedKeys(state, draft)).toEqual({
      added: ["c.denied.view", "d.none.view", "e.missing.view"],
      removed: ["a.role.view", "b.personal.view"]
    });
  });

  it("buildOperationsDraftPatch: o'zgarish yo'q — null", () => {
    const state = new Map([["a.x.view", st(true, "none", true)]]);
    expect(buildOperationsDraftPatch(state, new Map([["a.x.view", true]]))).toBeNull();
    expect(buildOperationsDraftPatch(state, new Map())).toBeNull();
  });
});

describe("access history summary", () => {
  it("PATCH tanasi va rol tarkibi", () => {
    expect(
      summarizeAccessLogNew({ merge_permissions: true, permissions: ["a", "b"], denied_permissions: ["c"], remove_permission_keys: ["d"] })
    ).toEqual(["Добавлено: 2 операции", "Запрещено: 1 операция", "Откреплено: 1 операция"]);
    expect(summarizeAccessLogNew({ grant_delegation_allow: ["a"] })).toEqual(["Может выдавать: +1 операция"]);
    expect(summarizeAccessLogNew({ is_active: false })).toEqual(["Пользователь деактивирован"]);
    expect(summarizeAccessLogNew({ role_key: "operator", added: ["a", "b", "c", "d", "e"] })).toEqual(["Добавлено в роль: 5 операций"]);
    expect(summarizeAccessLogOld({ role: "operator", is_active: true })).toEqual(["Роль: Оператор", "Активен"]);
    expect(summarizeAccessLogNew(null)).toEqual([]);
  });
});

describe("access users filter", () => {
  const u = (id: number, role: string, status: "active" | "inactive", manage: boolean): AccessUserRow => ({
    id,
    login: `u${id}`,
    full_name: `User ${id}`,
    role,
    status,
    operations_count: 0,
    branch: null,
    code: null,
    has_access_manage: manage
  });
  const rows = [u(1, "operator", "active", true), u(2, "operator", "inactive", false), u(3, "manager", "active", false)];

  it("Роль / Статус / Предоставление доступа", () => {
    expect(filterAccessUsers(rows, { role: "", status: "all", manage: "all" }).map((r) => r.id)).toEqual([1, 2, 3]);
    expect(filterAccessUsers(rows, { role: "operator", status: "all", manage: "all" }).map((r) => r.id)).toEqual([1, 2]);
    expect(filterAccessUsers(rows, { role: "", status: "active", manage: "all" }).map((r) => r.id)).toEqual([1, 3]);
    expect(filterAccessUsers(rows, { role: "", status: "all", manage: "yes" }).map((r) => r.id)).toEqual([1]);
    expect(filterAccessUsers(rows, { role: "", status: "active", manage: "no" }).map((r) => r.id)).toEqual([3]);
  });
});

describe("«Фильтр» operatsiyalar paneli", () => {
  const role: AccessOpMatrixState = { from_role: true, user_effect: "none", effective: true };
  const personal: AccessOpMatrixState = { from_role: false, user_effect: "allow", effective: true };
  const denied: AccessOpMatrixState = { from_role: true, user_effect: "deny", effective: false };
  const none: AccessOpMatrixState = { from_role: false, user_effect: "none", effective: false };

  it("default: faqat amaldagi operatsiyalar", () => {
    expect([role, personal, denied, none].map((r) => opMatchesFilter(r, false, EMPTY_OPS_FILTER))).toEqual([true, true, false, false]);
  });

  it("Статус va Предоставление доступа", () => {
    expect(opMatchesFilter(role, false, { ...EMPTY_OPS_FILTER, source: "role" })).toBe(true);
    expect(opMatchesFilter(personal, false, { ...EMPTY_OPS_FILTER, source: "role" })).toBe(false);
    expect(opMatchesFilter(personal, false, { ...EMPTY_OPS_FILTER, source: "personal" })).toBe(true);
    expect(opMatchesFilter(denied, false, { ...EMPTY_OPS_FILTER, source: "denied" })).toBe(true);
    expect(opMatchesFilter(role, false, { ...EMPTY_OPS_FILTER, source: "denied" })).toBe(false);
    expect(opMatchesFilter(role, true, { ...EMPTY_OPS_FILTER, grant: "yes" })).toBe(true);
    expect(opMatchesFilter(role, false, { ...EMPTY_OPS_FILTER, grant: "yes" })).toBe(false);
    expect(opMatchesFilter(role, false, { ...EMPTY_OPS_FILTER, grant: "no" })).toBe(true);
  });

  it("открепить: roldan → deny, shaxsiy → remove; запрет снять → remove", () => {
    const m = new Map([
      ["a", role],
      ["b", personal],
      ["c", denied]
    ]);
    expect(patchForKeys(m, ["a", "b"], false)).toEqual({ remove_permission_keys: ["b"], merge_permissions: true, denied_permissions: ["a"] });
    expect(patchForKeys(m, ["c"], true)).toEqual({ remove_permission_keys: ["c"] });
  });
});
