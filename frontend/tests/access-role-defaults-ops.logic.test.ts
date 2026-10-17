import { describe, expect, it } from "vitest";
import {
  buildRoleGrantedGroups,
  roleOpDisplayLabel
} from "../components/access/access-role-defaults-ops.logic";

describe("access-role-defaults-ops.logic", () => {
  it("L1/L2 guruhlaydi", () => {
    const groups = buildRoleGrantedGroups([
      {
        key: "orders.zakaz.view",
        module: "orders",
        section: "zakaz",
        description: "Просмотр заказов",
        parent_path: "Заявки · Заказ"
      },
      {
        key: "orders.vozvrat.view",
        module: "orders",
        section: "vozvrat",
        description: "Просмотр возвратов",
        parent_path: "Заявки · Возврат"
      },
      {
        key: "access.view",
        module: "access",
        section: null,
        description: "Доступ",
        parent_path: "Доступ"
      }
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Доступ", "Заявки"]);
    const zayavki = groups.find((g) => g.label === "Заявки")!;
    expect(zayavki.children.map((c) => c.label).sort()).toEqual(["Возврат", "Заказ"]);
    expect(zayavki.rows).toHaveLength(2);
    const dostup = groups.find((g) => g.label === "Доступ")!;
    expect(dostup.directRows).toHaveLength(1);
    expect(dostup.children).toHaveLength(0);
  });

  it("roleOpDisplayLabel — description yoki key", () => {
    expect(
      roleOpDisplayLabel({
        key: "x.y",
        module: "x",
        section: null,
        description: "  Hello  ",
        parent_path: "X"
      })
    ).toBe("Hello");
  });
});
