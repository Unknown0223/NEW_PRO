import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Tenant = { id: number; slug: string; name: string; is_active: boolean };
type User = {
  id: number;
  tenant_id: number;
  name: string;
  login: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  max_sessions?: number | null;
  must_change_password?: boolean;
  failed_login_count?: number;
  locked_until?: Date | null;
};
type RefreshToken = {
  id: number;
  tenant_id: number;
  user_id: number;
  token_hash: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  device_name?: string | null;
  device_id?: string | null;
  user_agent?: string | null;
  ip_address?: string | null;
};

const { state, mockPrisma } = vi.hoisted(() => {
  const state: {
    tenants: Tenant[];
    users: User[];
    refreshTokens: RefreshToken[];
  } = {
    tenants: [],
    users: [],
    refreshTokens: []
  };

  const refreshTokenApi = {
    count: vi.fn(async () => 0),
    findMany: vi.fn(async () => []),
    create: vi.fn(
      async ({
        data,
        select
      }: {
        data: Omit<RefreshToken, "id" | "revoked_at"> & { revoked_at?: Date | null };
        select?: { id?: true };
      }) => {
        const row: RefreshToken = {
          id: state.refreshTokens.length + 1,
          ...data,
          revoked_at: data.revoked_at ?? null
        };
        state.refreshTokens.push(row);
        if (select?.id) return { id: row.id };
        return row;
      }
    ),
    findUnique: vi.fn(
      async ({
        where,
        include,
        select
      }: {
        where: { token_hash?: string; id?: number };
        include?: unknown;
        select?: { family_id?: true; revoked_at?: true; expires_at?: true; user_id?: true };
      }) => {
        const row =
          where.id != null
            ? state.refreshTokens.find((r) => r.id === where.id)
            : where.token_hash != null
              ? state.refreshTokens.find((r) => r.token_hash === where.token_hash)
              : undefined;
        if (!row) return null;
        if (select) {
          const out: Record<string, unknown> = {};
          if (select.family_id) out.family_id = row.family_id;
          if (select.revoked_at) out.revoked_at = row.revoked_at;
          if (select.expires_at) out.expires_at = row.expires_at;
          if (select.user_id) out.user_id = row.user_id;
          return out;
        }
        if (include) {
          const user = state.users.find((u) => u.id === row.user_id)!;
          const tenant = state.tenants.find((t) => t.id === row.tenant_id)!;
          return {
            ...row,
            user: {
              ...user,
              app_access: true,
              code: null,
              first_name: user.name,
              last_name: null,
              middle_name: null
            },
            tenant
          };
        }
        return row;
      }
    ),
    update: vi.fn(async ({ where, data }: { where: { id: number }; data: { revoked_at?: Date } }) => {
      const row = state.refreshTokens.find((r) => r.id === where.id);
      if (row && data.revoked_at) row.revoked_at = data.revoked_at;
      return row;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data
      }: {
        where: {
          token_hash?: string;
          revoked_at?: null;
          family_id?: string;
          id?: { in: number[] };
          user_id?: number;
          tenant_id?: number;
          device_id?: string;
          expires_at?: { gt: Date };
        };
        data: { revoked_at: Date };
      }) => {
        let count = 0;
        state.refreshTokens.forEach((r) => {
          if (where.revoked_at === null && r.revoked_at !== null) return;
          if (where.token_hash != null && r.token_hash !== where.token_hash) return;
          if (where.family_id != null && r.family_id !== where.family_id) return;
          if (where.id?.in && !where.id.in.includes(r.id)) return;
          if (where.user_id != null && r.user_id !== where.user_id) return;
          if (where.tenant_id != null && r.tenant_id !== where.tenant_id) return;
          if (where.device_id != null && r.device_id !== where.device_id) return;
          r.revoked_at = data.revoked_at;
          count += 1;
        });
        return { count };
      }
    )
  };

  const mockPrisma = {
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: number } }) => {
        if (where.slug != null) {
          return state.tenants.find((t) => t.slug === where.slug) ?? null;
        }
        if (where.id != null) {
          return state.tenants.find((t) => t.id === where.id) ?? null;
        }
        return null;
      })
    },
    workSlot: {
      count: vi.fn(async () => 0)
    },
    user: {
      findUnique: vi.fn(
        async ({
          where
        }: {
          where: { tenant_id_login?: { tenant_id: number; login: string }; id?: number };
        }) => {
          if (where.tenant_id_login) {
            return (
              state.users.find(
                (u) =>
                  u.tenant_id === where.tenant_id_login!.tenant_id &&
                  u.login === where.tenant_id_login!.login
              ) ?? null
            );
          }
          if (where.id != null) {
            const row = state.users.find((u) => u.id === where.id);
            if (!row) return null;
            return {
              ...row,
              app_access: true,
              code: null,
              first_name: row.name,
              last_name: null,
              middle_name: null
            };
          }
          return null;
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const row = state.users.find((u) => u.id === where.id);
        if (!row) throw new Error("User not found");
        Object.assign(row, data);
        return row;
      })
    },
    refreshToken: refreshTokenApi,
    $transaction: vi.fn(async (fn: (tx: { refreshToken: typeof refreshTokenApi }) => Promise<unknown>) =>
      fn({ refreshToken: refreshTokenApi })
    )
  };

  return { state, mockPrisma };
});

vi.mock("../src/config/database", () => ({
  prisma: mockPrisma
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(async (password: string, hash: string) => password === "secret123" && hash === "hashed-secret")
  }
}));

vi.mock("../src/modules/auth/app-access.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/modules/auth/app-access.service")>();
  return {
    ...actual,
    hasActiveSessionForDevice: vi.fn(async () => true)
  };
});

vi.mock("../src/modules/work-slots/work-slots.query", () => ({
  loadActiveWorkSlotsByUserIds: vi.fn(async () => new Map()),
  getActiveSlotForUser: vi.fn(async () => ({ slot_id: 42, slot_code: "WS-42" }))
}));

import { buildApp } from "../src/app";

const app = buildApp();

const MOBILE_LOGIN = { apk_version: "3.1.0" };

describe("auth + tenant integration", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    state.tenants = [
      { id: 1, slug: "andijon", name: "Andijon", is_active: true },
      { id: 2, slug: "namangan", name: "Namangan", is_active: true }
    ];
    state.users = [
      {
        id: 10,
        tenant_id: 1,
        name: "Agent One",
        login: "agent01",
        password_hash: "hashed-secret",
        role: "agent",
        is_active: true,
        max_sessions: 2,
        must_change_password: false,
        failed_login_count: 0,
        locked_until: null
      }
    ];
    state.refreshTokens = [];
    vi.clearAllMocks();
  });

  it("returns 401 for protected route without token", async () => {
    const response = await request(app.server).get("/api/andijon/protected");
    expect(response.status).toBe(401);
  });

  it("login works and grants access for the same tenant", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTypeOf("string");
    expect(loginResponse.body.refreshToken).toBeTypeOf("string");

    const protectedResponse = await request(app.server)
      .get("/api/andijon/protected")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body.ok).toBe(true);
  });

  it("returns 403 on cross-tenant token usage", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });
    expect(loginResponse.status).toBe(200);

    const response = await request(app.server)
      .get("/api/namangan/protected")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(response.status).toBe(403);
  });

  it("login works via /api/auth prefix", async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.accessToken).toBeTypeOf("string");
  });

  it("GET /auth/me returns user when authorized", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });

    const meResponse = await request(app.server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.login).toBe("agent01");
    expect(meResponse.body.user.role).toBe("agent");
  });

  it("GET /api/auth/me returns user when authorized", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });

    const meResponse = await request(app.server)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.tenantId).toBe(1);
    expect(meResponse.body.user.work_slot_id).toBe(42);
    expect(meResponse.body.user.work_slot_code).toBe("WS-42");
  });

  it("refresh rotates refresh token", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });

    const oldHash = createHash("sha256").update(loginResponse.body.refreshToken).digest("hex");

    const refreshResponse = await request(app.server).post("/auth/refresh").send({
      refreshToken: loginResponse.body.refreshToken
    });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toBeTypeOf("string");
    expect(refreshResponse.body.refreshToken).toBeTypeOf("string");

    const oldTokenRow = state.refreshTokens.find((r) => r.token_hash === oldHash);
    expect(oldTokenRow?.revoked_at).not.toBeNull();
    expect(oldTokenRow?.family_id).toBeTypeOf("string");
    const newHash = createHash("sha256").update(refreshResponse.body.refreshToken).digest("hex");
    const newRow = state.refreshTokens.find((r) => r.token_hash === newHash);
    expect(newRow?.family_id).toBe(oldTokenRow?.family_id);
  });

  it("refresh reuse after grace revokes the whole family", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });
    const stolen = loginResponse.body.refreshToken as string;
    const stolenHash = createHash("sha256").update(stolen).digest("hex");

    const firstRefresh = await request(app.server).post("/auth/refresh").send({ refreshToken: stolen });
    expect(firstRefresh.status).toBe(200);

    const familyId = state.refreshTokens.find((r) => r.token_hash === stolenHash)?.family_id;
    expect(familyId).toBeTruthy();

    const stolenRow = state.refreshTokens.find((r) => r.token_hash === stolenHash)!;
    stolenRow.revoked_at = new Date(Date.now() - 60_000);

    const reuse = await request(app.server).post("/auth/refresh").send({ refreshToken: stolen });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error).toBe("REFRESH_REUSE_DETECTED");

    const activeInFamily = state.refreshTokens.filter(
      (r) => r.family_id === familyId && r.revoked_at === null
    );
    expect(activeInFamily).toHaveLength(0);
  });

  it("rejects agent web login without apk_version", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body.error).toBe("WEB_ACCESS_DENIED");
  });

  it("rejects agent /auth/me from a browser user-agent", async () => {
    const loginResponse = await request(app.server).post("/auth/login").send({
      slug: "andijon",
      login: "agent01",
      password: "secret123",
      ...MOBILE_LOGIN
    });
    expect(loginResponse.status).toBe(200);

    const meResponse = await request(app.server)
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginResponse.body.accessToken}`)
      .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0");

    expect(meResponse.status).toBe(403);
    expect(meResponse.body.error).toBe("WEB_ACCESS_DENIED");
  });
});
