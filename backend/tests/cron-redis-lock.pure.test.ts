import { describe, expect, it, vi } from "vitest";

describe("withCronLock", () => {
  it("runs fn when redis unavailable (unlocked fallback)", async () => {
    vi.resetModules();
    vi.doMock("../src/lib/redis-cache", () => ({
      getRedisForApp: vi.fn(async () => {
        throw new Error("no redis");
      })
    }));
    const { withCronLock } = await import("../src/lib/cron-redis-lock");
    let ran = 0;
    const r = await withCronLock("test-lock", 1000, async () => {
      ran += 1;
    });
    expect(r).toBe("ran_unlocked");
    expect(ran).toBe(1);
  });

  it("skips when lock held", async () => {
    vi.resetModules();
    const set = vi.fn(async () => null);
    vi.doMock("../src/lib/redis-cache", () => ({
      getRedisForApp: vi.fn(async () => ({ set, del: vi.fn() }))
    }));
    const { withCronLock } = await import("../src/lib/cron-redis-lock");
    let ran = 0;
    const r = await withCronLock("test-lock-2", 1000, async () => {
      ran += 1;
    });
    expect(r).toBe("skipped");
    expect(ran).toBe(0);
  });
});
