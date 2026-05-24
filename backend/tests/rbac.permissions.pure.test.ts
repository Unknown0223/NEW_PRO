import { describe, expect, it, vi } from "vitest";
import { ensurePermissionIdsForKeys } from "../src/modules/access/rbac.permissions";

describe("ensurePermissionIdsForKeys", () => {
  it("resolves all missing keys in parallel (Promise.all)", async () => {
    const upsertCalls: string[] = [];
    const tx = {
      permission: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockImplementation(({ where }: { where: { tenant_id_key: { key: string } } }) => {
          const key = where.tenant_id_key.key;
          upsertCalls.push(key);
          return Promise.resolve({ id: upsertCalls.length, key });
        })
      }
    };

    const map = await ensurePermissionIdsForKeys(tx as never, 1, ["a.read", "b.write", "c.delete"]);

    expect(map.size).toBe(3);
    expect(map.get("a.read")).toBe(1);
    expect(map.get("b.write")).toBe(2);
    expect(map.get("c.delete")).toBe(3);
    expect(upsertCalls).toHaveLength(3);
  });
});
