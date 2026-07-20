/**
 * App access (Доступ к приложению) end-to-end verify.
 *
 * 1) Pure helpers — DBsiz.
 * 2) Live API (test1) — login deny + JWT /me + protected route → APP_ACCESS_DENIED.
 *
 *   cd backend && npm run app-access:verify
 *
 * Env (ixtiyoriy):
 *   APP_ACCESS_VERIFY_BASE=http://127.0.0.1:18080
 *   APP_ACCESS_VERIFY_SLUG=test1
 *   APP_ACCESS_VERIFY_ADMIN_LOGIN=admin
 *   APP_ACCESS_VERIFY_ADMIN_PASSWORD=secret123
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const BASE = (process.env.APP_ACCESS_VERIFY_BASE ?? "http://127.0.0.1:18080").replace(/\/$/, "");
const SLUG = process.env.APP_ACCESS_VERIFY_SLUG ?? "test1";
const ADMIN_LOGIN = process.env.APP_ACCESS_VERIFY_ADMIN_LOGIN ?? "admin";
const ADMIN_PASSWORD = process.env.APP_ACCESS_VERIFY_ADMIN_PASSWORD ?? "secret123";
/** Script sets this password on the candidate agent for deterministic checks. */
const TEMP_AGENT_PASSWORD = process.env.APP_ACCESS_VERIFY_AGENT_PASSWORD ?? "AppAccessVerify1!";

let failures = 0;

function ok(msg: string) {
  console.log(`[OK] ${msg}`);
}

function fail(msg: string) {
  failures++;
  console.error(`[FAIL] ${msg}`);
}

function assert(cond: boolean, msg: string) {
  if (cond) ok(msg);
  else fail(msg);
}

async function jsonFetch(
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

type AgentRow = {
  id: number;
  login: string;
  app_access?: boolean;
  is_active?: boolean;
};

async function runLiveApi(): Promise<void> {
  console.log(`\n--- Live API @ ${BASE} (tenant ${SLUG}) ---`);

  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    fail(`Backend unreachable at ${BASE}/health — start API or skip live checks`);
    return;
  }
  ok("health");

  const loginAdmin = await jsonFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      slug: SLUG,
      login: ADMIN_LOGIN,
      password: ADMIN_PASSWORD,
      device_id: "app-access-verify-admin"
    })
  });
  assert(loginAdmin.status === 200, `admin login (${loginAdmin.status})`);
  const adminToken = String(loginAdmin.body.accessToken ?? "");
  if (!adminToken) {
    fail("admin accessToken missing");
    return;
  }

  const agentsRes = await jsonFetch(`/api/${SLUG}/agents?limit=50`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(agentsRes.status === 200, `list agents (${agentsRes.status})`);
  const agentsRaw = agentsRes.body.data ?? agentsRes.body;
  const agents = (Array.isArray(agentsRaw) ? agentsRaw : []) as AgentRow[];

  const candidate =
    agents.find((a) => a.is_active !== false && a.login && a.login !== ADMIN_LOGIN) ?? null;
  if (!candidate) {
    fail("no active agent found on test1 to toggle app_access");
    return;
  }
  ok(`using agent id=${candidate.id} login=${candidate.login}`);
  const prevAccess = candidate.app_access !== false;

  // Deterministic password + access on (may also need work slot — skip if USER_NOT_ON_SLOT).
  const prep = await jsonFetch(`/api/${SLUG}/agents/${candidate.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ app_access: true, password: TEMP_AGENT_PASSWORD })
  });
  assert(prep.status === 200, `prep agent password+access (${prep.status})`);

  const agentLogin = await jsonFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      slug: SLUG,
      login: candidate.login,
      password: TEMP_AGENT_PASSWORD,
      device_id: "app-access-verify-agent"
    })
  });

  if (agentLogin.status === 403 && agentLogin.body.error === "USER_NOT_ON_SLOT") {
    console.warn(
      "[WARN] Agent not on work slot — cannot obtain JWT; still verifying login deny after app_access=false"
    );
  } else if (agentLogin.status !== 200 || !agentLogin.body.accessToken) {
    fail(
      `agent login before revoke failed: ${agentLogin.status} ${String(agentLogin.body.error ?? "")}`
    );
  } else {
    ok("agent login while app_access=true");
  }

  const agentAccessToken =
    agentLogin.status === 200 && agentLogin.body.accessToken
      ? String(agentLogin.body.accessToken)
      : null;
  const agentRefreshToken =
    agentLogin.status === 200 && agentLogin.body.refreshToken
      ? String(agentLogin.body.refreshToken)
      : null;

  const patchOff = await jsonFetch(`/api/${SLUG}/agents/${candidate.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ app_access: false })
  });
  assert(patchOff.status === 200, `patch app_access=false (${patchOff.status})`);

  const deniedLogin = await jsonFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      slug: SLUG,
      login: candidate.login,
      password: TEMP_AGENT_PASSWORD,
      device_id: "app-access-verify-agent-deny"
    })
  });
  assert(
    deniedLogin.status === 403 && deniedLogin.body.error === "APP_ACCESS_DENIED",
    `login → APP_ACCESS_DENIED (got ${deniedLogin.status} ${String(deniedLogin.body.error)})`
  );
  assert(
    typeof deniedLogin.body.message === "string" &&
      String(deniedLogin.body.message).includes("Ilova kirish"),
    "denial message present (UZ/RU)"
  );

  if (agentAccessToken) {
    const me = await jsonFetch("/auth/me", {
      headers: { Authorization: `Bearer ${agentAccessToken}` }
    });
    assert(
      me.status === 403 && me.body.error === "APP_ACCESS_DENIED",
      `/auth/me stale JWT → APP_ACCESS_DENIED (got ${me.status} ${String(me.body.error)})`
    );

    const protectedHit = await jsonFetch(`/api/${SLUG}/protected`, {
      headers: { Authorization: `Bearer ${agentAccessToken}` }
    });
    assert(
      protectedHit.status === 403 && protectedHit.body.error === "APP_ACCESS_DENIED",
      `/protected stale JWT → APP_ACCESS_DENIED (got ${protectedHit.status})`
    );

    const mePerms = await jsonFetch(`/api/${SLUG}/access/me-permissions`, {
      headers: { Authorization: `Bearer ${agentAccessToken}` }
    });
    assert(
      mePerms.status === 403 && mePerms.body.error === "APP_ACCESS_DENIED",
      `me-permissions → APP_ACCESS_DENIED (got ${mePerms.status})`
    );

    if (agentRefreshToken) {
      const refresh = await jsonFetch("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken: agentRefreshToken })
      });
      assert(
        refresh.status === 401 ||
          (refresh.status === 403 && refresh.body.error === "APP_ACCESS_DENIED"),
        `refresh denied after revoke (got ${refresh.status} ${String(refresh.body.error)})`
      );
    }
  } else {
    console.warn("[WARN] Skipped stale-token API checks (no agent JWT — often USER_NOT_ON_SLOT).");
  }

  await jsonFetch(`/api/${SLUG}/agents/${candidate.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ app_access: prevAccess })
  });
  ok(`restored app_access=${prevAccess} for agent ${candidate.id}`);

  const adminMe = await jsonFetch("/auth/me", {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(adminMe.status === 200, "admin /me still works (exempt)");
}

function runPureVitest(): void {
  console.log("\n--- Pure unit (vitest) ---");
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vitest", "run", "tests/app-access.pure.test.ts"],
    {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
      shell: process.platform === "win32"
    }
  );
  if (r.status !== 0) {
    fail("pure vitest failed");
  } else {
    ok("pure vitest");
  }
}

async function main() {
  console.log("app-access:verify");
  runPureVitest();
  try {
    await runLiveApi();
  } catch (e) {
    fail(`live API threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  console.log(`\nDone. failures=${failures}`);
  process.exit(failures > 0 ? 1 : 0);
}

void main();
