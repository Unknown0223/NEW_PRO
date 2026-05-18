import { describe, expect, it } from "vitest";
import { LEGACY_PERMISSION_METADATA } from "../src/modules/access/legacy-permission-labels";
import { catalogParentPathLabel } from "../src/modules/access/permission-catalog-parent";
import { DEFAULT_PERMISSION_METADATA } from "../src/modules/access/permission-catalog";

describe("legacy permission catalog metadata", () => {
  it("does not reuse DEFAULT keys (defaults win in sync)", () => {
    const def = new Set(Object.keys(DEFAULT_PERMISSION_METADATA));
    for (const k of Object.keys(LEGACY_PERMISSION_METADATA)) {
      expect(def.has(k), `legacy key collides with default: ${k}`).toBe(false);
    }
  });

  it("has one entry per legacy doc leaf (expected magnitude)", () => {
    expect(Object.keys(LEGACY_PERMISSION_METADATA).length).toBeGreaterThanOrEqual(330);
  });

  it("catalogParentPathLabel matches Access UI nav (RU parent)", () => {
    expect(catalogParentPathLabel("orders", "Заказы / Заказ")).toBe("Заявки");
    expect(catalogParentPathLabel("dashboard", "Дашборд")).toBe("Дашборд");
    expect(catalogParentPathLabel("staff", "Пользователи / Агент")).toBe("Агенты");
    expect(catalogParentPathLabel("staff", "Пользователи / Аудитор")).toBe("Аудит");
    expect(catalogParentPathLabel("audit", "Аудит")).toBe("Аудит");
  });
});
