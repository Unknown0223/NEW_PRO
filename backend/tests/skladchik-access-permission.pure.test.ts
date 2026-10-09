import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/config/database", () => ({
  prisma: {
    user: { findFirst: vi.fn() }
  }
}));

vi.mock("../src/modules/access/rbac.service", () => ({
  resolveUserPermissionKeys: vi.fn()
}));

import { resolveUserPermissionKeys } from "../src/modules/access/rbac.service";
import { requireRolesOrSkladchikEntitlement } from "../src/modules/staff/skladchik-access.prehandler";

function mockReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis()
  } as never;
}

describe("requireRolesOrSkladchikEntitlement + Dostup permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows catalog role without permission lookup", async () => {
    const pre = requireRolesOrSkladchikEntitlement(
      ["admin", "operator"],
      "stock_balance_list",
      ["warehouse.ostatki.view"]
    );
    const request = {
      user: { sub: "5", tenantId: 1, role: "operator", login: "op" },
      tenant: { id: 1 }
    } as never;
    await pre(request, mockReply());
    expect(resolveUserPermissionKeys).not.toHaveBeenCalled();
  });

  it("allows cashier when Dostup grants warehouse.ostatki.view", async () => {
    vi.mocked(resolveUserPermissionKeys).mockResolvedValue(new Set(["warehouse.ostatki.view"]));
    const pre = requireRolesOrSkladchikEntitlement(
      ["admin", "operator"],
      "stock_balance_list",
      ["warehouse.ostatki.view"]
    );
    const request = {
      user: { sub: "9", tenantId: 1, role: "cashier", login: "kassa" },
      tenant: { id: 1 }
    } as never;
    const reply = mockReply();
    await pre(request, reply);
    expect(resolveUserPermissionKeys).toHaveBeenCalledWith(1, 9, "cashier");
    expect((reply as { send: ReturnType<typeof vi.fn> }).send).not.toHaveBeenCalled();
  });

  it("rejects cashier without permission and without skladchik entitlement", async () => {
    vi.mocked(resolveUserPermissionKeys).mockResolvedValue(new Set(["cash.kassa.view"]));
    const pre = requireRolesOrSkladchikEntitlement(
      ["admin", "operator"],
      "stock_balance_list",
      ["warehouse.ostatki.view"]
    );
    const request = {
      user: { sub: "9", tenantId: 1, role: "cashier", login: "kassa" },
      tenant: { id: 1 },
      headers: {},
      id: "req-1"
    } as never;
    const reply = mockReply();
    await pre(request, reply);
    expect((reply as { status: ReturnType<typeof vi.fn> }).status).toHaveBeenCalledWith(403);
  });
});
