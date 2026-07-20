/**
 * Access re-audit: Operator lean defaults + UI/API permission gates smoke.
 *
 *   npm run access:audit
 *   CLEAR_OVERRIDES=1 npm run access:audit   # role-only baseline for operator
 *   RESTORE=1 npm run access:audit           # undo sample deny after PASS
 *
 * Requires API at http://127.0.0.1:18080, tenant test1.
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:18080";
const slug = "test1";
const RESTORE = process.env.RESTORE === "1";
const CLEAR_OVERRIDES = process.env.CLEAR_OVERRIDES === "1";

/** Lean operator preset must NOT include these module prefixes. */
const OPERATOR_FORBIDDEN_PREFIXES = ["cash.", "warehouse.", "staff.", "access.", "suppliers.", "settings."];

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t, status: res.status };
  }
}

async function login(login, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, login, password })
  });
  const body = await json(res);
  if (!res.ok) {
    throw new Error(`login failed ${login} ${res.status} ${JSON.stringify(body)}`);
  }
  return body.accessToken || body.access_token || body.data?.accessToken;
}

async function loginOperator() {
  const candidates = [process.env.OPERATOR_PASSWORD, "secret123", "operator"].filter(Boolean);
  let lastErr;
  for (const pw of candidates) {
    try {
      return await login("operator", pw);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("operator login failed");
}

function countByPrefix(keys, prefix) {
  return keys.filter((k) => k.startsWith(prefix)).length;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function moduleTop(keys, n = 12) {
  const m = new Map();
  for (const k of keys) {
    const mod = String(k).split(".")[0] || "?";
    m.set(mod, (m.get(mod) || 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
}

async function patchOperatorPerms(adminTok, opId, body) {
  const res = await fetch(`${BASE}/api/${slug}/access/users/${opId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const b = await json(res);
  assert(res.ok, `PATCH operator failed ${res.status} ${JSON.stringify(b).slice(0, 300)}`);
  return b;
}

async function meKeys(tok) {
  const body = await json(
    await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
      headers: { Authorization: `Bearer ${tok}` }
    })
  );
  return body.data?.keys || [];
}

async function main() {
  console.log("=== access:audit (test1) ===");
  const adminTok = await login("admin", "secret123");
  const opTok = await loginOperator();
  const ah = { Authorization: `Bearer ${adminTok}` };

  const usersBody = await json(
    await fetch(`${BASE}/api/${slug}/access/users?include_counts=true`, { headers: ah })
  );
  const users = usersBody.data || usersBody;
  const op = (Array.isArray(users) ? users : []).find(
    (u) => u.login === "operator" || (u.name && String(u.name).includes("Operator"))
  );
  assert(op, `operator user not found`);
  console.log("operator id=", op.id, "login=", op.login, "operations_count=", op.operations_count);

  if (CLEAR_OVERRIDES) {
    await patchOperatorPerms(adminTok, op.id, {
      merge_permissions: false,
      permissions: [],
      denied_permissions: []
    });
    console.log("CLEAR_OVERRIDES: personal allow/deny wiped");
  }

  let keys = await meKeys(opTok);
  console.log("BASELINE me-permissions:", keys.length, "| modules:", moduleTop(keys));
  const grants = countByPrefix(keys, "access.grant.");
  assert(grants === 0, `me-permissions must not include access.grant.* (got ${grants})`);

  for (const prefix of OPERATOR_FORBIDDEN_PREFIXES) {
    const n = countByPrefix(keys, prefix);
    assert(
      n === 0,
      `FAIL: lean operator still has ${n} keys under ${prefix}* — run: npx tsx scripts/seed-role-defaults.ts test1 --force (and CLEAR_OVERRIDES=1)`
    );
  }
  assert(keys.includes("orders.zakaz.view") || keys.includes("dashboard.prodazhi.view"),
    "FAIL: operator lean preset should keep orders or dashboard view");

  // Cash-desk list: without cash.kassa.view expect 403 (picker/payment aliases may still allow)
  const desksNoCash = await fetch(`${BASE}/api/${slug}/cash-desks?limit=5`, {
    headers: { Authorization: `Bearer ${opTok}` }
  });
  const desksNoBody = await json(desksNoCash);
  console.log("cash-desks without cash.kassa.*:", desksNoCash.status, "rows=", (desksNoBody.data || []).length);
  // Operator lean has work_slots.view → list may still 200 for picker; settings UI stays hidden via nav.
  if (desksNoCash.status === 403) {
    console.log("PASS: cash-desks API 403 without cash view");
  } else if (desksNoCash.ok) {
    console.log("NOTE: list allowed via picker alias (work_slots/payment); nav still needs cash.kassa.view");
  }

  // Write API must require cash.kassa.create (not role alone)
  const desksAdmin = await json(
    await fetch(`${BASE}/api/${slug}/cash-desks?limit=1`, { headers: ah })
  );
  const deskId = (desksAdmin.data || [])[0]?.id;
  if (deskId) {
    const denyWrite = await fetch(`${BASE}/api/${slug}/cash-desks/${deskId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${opTok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "access-audit-no-create" })
    });
    assert(denyWrite.status === 403, `FAIL: PATCH cash-desk without create expected 403, got ${denyWrite.status}`);
    console.log("PASS: PATCH cash-desk without create → 403");
  } else {
    console.log("NOTE: skip PATCH gate (no cash desks)");
  }

  // Grant cash.kassa.view only → should appear in me-permissions
  await patchOperatorPerms(adminTok, op.id, {
    merge_permissions: true,
    permissions: ["cash.kassa.view"]
  });
  keys = await meKeys(opTok);
  assert(keys.includes("cash.kassa.view") || keys.includes("cash.view"),
    "FAIL: after allow cash.kassa.view, me-permissions missing it");
  assert(!keys.includes("cash.kassa.create"), "FAIL: create should still be absent after view-only grant");
  assert(!keys.includes("cash.kassa.history"), "FAIL: history should still be absent after view-only grant");
  console.log("PASS: grant cash.kassa.view only → create/history still absent");

  // Grant create + history one-by-one
  await patchOperatorPerms(adminTok, op.id, {
    merge_permissions: true,
    permissions: ["cash.kassa.create", "cash.kassa.history"]
  });
  keys = await meKeys(opTok);
  assert(keys.includes("cash.kassa.create"), "FAIL: create missing after grant");
  assert(keys.includes("cash.kassa.history"), "FAIL: history missing after grant");
  console.log("PASS: grant create+history → both present");

  // Deny create → create gone, view may remain
  await patchOperatorPerms(adminTok, op.id, {
    merge_permissions: true,
    denied_permissions: ["cash.kassa.create"]
  });
  keys = await meKeys(opTok);
  assert(!keys.includes("cash.kassa.create"), "FAIL: deny create did not remove create");
  console.log("PASS: deny cash.kassa.create removes create from me-permissions");

  // Probe: staff.agent.view absent by default
  assert(!keys.includes("staff.agent.view"), "FAIL: staff.agent.view should not be on lean operator after cash grants only");

  await patchOperatorPerms(adminTok, op.id, {
    merge_permissions: true,
    permissions: ["staff.agent.view"]
  });
  keys = await meKeys(opTok);
  assert(keys.includes("staff.agent.view") || keys.includes("staff.agent.spisok_agentov"),
    "FAIL: staff.agent.view grant not reflected");
  console.log("PASS: grant staff.agent.view → appears");

  // Seed sample users presence (admin list)
  const byLogin = new Map((Array.isArray(users) ? users : []).map((u) => [u.login, u]));
  for (const login of ["admin", "operator", "supervisor", "agent"]) {
    const u = byLogin.get(login);
    console.log(`seed user ${login}:`, u ? `id=${u.id} role=${u.role ?? u.roles?.[0] ?? "?"}` : "MISSING");
  }

  if (RESTORE) {
    await patchOperatorPerms(adminTok, op.id, {
      merge_permissions: false,
      permissions: [],
      denied_permissions: []
    });
    // Also strip probe allows by denying them then clearing — empty personal layer
    console.log("RESTORE: operator personal overrides cleared");
  } else {
    console.log("NOTE: left sample allows/denies on operator (set RESTORE=1 to clear)");
  }

  console.log("\naccess:audit PASS");
  console.log("UI retest: login operator → Кассы: no Add/Edit/History without create/history; sidebar without cash/warehouse/staff until Access grants.");
}

main().catch((e) => {
  console.error("access:audit FAIL:", e.message || e);
  process.exit(1);
});
