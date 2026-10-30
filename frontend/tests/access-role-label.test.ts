import { describe, expect, it } from "vitest";
import { accessRoleDisplayName, accessRoleLabel } from "@/lib/access-role-label";
import { WEB_ACCESS_ROLE_LABELS } from "@/lib/distribution-roles";

describe("access role labels", () => {
  it("keeps sales_director and commercial_director as distinct roles", () => {
    expect(WEB_ACCESS_ROLE_LABELS.sales_director).toBe("Директор по продажам");
    expect(accessRoleLabel("sales_director")).toBe("Директор по продажам");
    expect(accessRoleLabel("commercial_director")).toBe("Коммерческий директор");
    expect(accessRoleLabel("sales_director")).not.toBe(accessRoleLabel("commercial_director"));
  });

  it("maps raw storekeeper_view instead of showing the key", () => {
    expect(accessRoleLabel("storekeeper_view")).toBe("Кладовщик (просмотр)");
    expect(accessRoleDisplayName("storekeeper_view", "storekeeper_view")).toBe("Кладовщик (просмотр)");
  });

  it("keeps a customized stored name", () => {
    expect(accessRoleDisplayName("sales_director", "Руководитель продаж")).toBe("Руководитель продаж");
  });
});
