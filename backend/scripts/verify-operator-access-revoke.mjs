/**
 * Smoke: deny representative Operator ops → me-permissions shrinks + sample API 403.
 * Also asserts access.grant.* are not counted as usable ops / me-permissions.
 *
 * Usage:
 *   node scripts/verify-dashboard-access-deny.mjs
 *   node scripts/verify-operator-access-revoke.mjs
 *
 * Requires API at http://127.0.0.1:18080, tenant test1.
 *
 * Env:
 *   OPERATOR_PASSWORD (default secret123, then operator)
 *   RESTORE=1 — restore representative allows after PASS (default: leave denies)
 *   CLEAR_OVERRIDES=1 — wipe user_permissions for operator before test (clean role baseline)
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:18080";
const slug = "test1";
const RESTORE = process.env.RESTORE === "1";
const CLEAR_OVERRIDES = process.env.CLEAR_OVERRIDES === "1";

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
  const candidates = [
    process.env.OPERATOR_PASSWORD,
    "secret123",
    "operator"
  ].filter(Boolean);
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

const denySample = [
  "dashboard.prodazhi.view",
  "dashboard.finansy.view",
  "dashboard.supervayzer.view",
  "dashboard.plan_fakt.view",
  "orders.zakaz.view",
  "orders.zakaz.create",
  "clients.klient.view",
  "work_slots.raboche_mesto.view",
  "warehouse.ostatki.view",
  "cash.oplaty_klientov.view",
  "staff.agent.view",
  "invoices.sborochnye.view"
];

function countByPrefix(keys, prefix) {
  return keys.filter((k) => k.startsWith(prefix)).length;
}

async function main() {
  const adminTok = await login("admin", "secret123");
  const opTok = await loginOperator();

  const usersRes = await fetch(`${BASE}/api/${slug}/access/users?include_counts=true`, {
    headers: { Authorization: `Bearer ${adminTok}` }
  });
  const usersBody = await json(usersRes);
  const users = usersBody.data || usersBody;
  const op = (Array.isArray(users) ? users : []).find(
    (u) => u.login === "operator" || (u.name && String(u.name).includes("Operator"))
  );
  if (!op) throw new Error(`operator user not found: ${JSON.stringify(usersBody).slice(0, 400)}`);
  console.log("operator id=", op.id, "login=", op.login, "operations_count=", op.operations_count);

  if (CLEAR_OVERRIDES) {
    // Replace all personal overrides with empty allow/deny (role-only baseline).
    const clear = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ merge_permissions: false, permissions: [], denied_permissions: [] })
    });
    console.log("CLEAR_OVERRIDES status", clear.status);
  }

  const meBefore = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${opTok}` }
  }).then(json);
  const beforeKeys = meBefore.data?.keys || [];
  const beforeGrants = countByPrefix(beforeKeys, "access.grant.");
  console.log("BEFORE me-permissions:", beforeKeys.length, "access.grant.*:", beforeGrants);

  if (beforeGrants > 0) {
    console.log("FAIL: me-permissions must not include access.grant.* (got", beforeGrants, ")");
    process.exit(1);
  }

  const patchRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ merge_permissions: true, denied_permissions: denySample })
  });
  const patchBody = await json(patchRes);
  console.log("PATCH deny sample status", patchRes.status, patchRes.ok ? "ok" : JSON.stringify(patchBody).slice(0, 300));

  const meAfter = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${opTok}` }
  }).then(json);
  const afterKeys = meAfter.data?.keys || [];
  const still = denySample.filter((k) => afterKeys.includes(k));
  console.log("AFTER me-permissions:", afterKeys.length, "still denied sample:", still.join(",") || "(none)");
  console.log("AFTER access.grant.*:", countByPrefix(afterKeys, "access.grant."));

  const usersAfter = await fetch(`${BASE}/api/${slug}/access/users?include_counts=true`, {
    headers: { Authorization: `Bearer ${adminTok}` }
  }).then(json);
  const opAfter = (usersAfter.data || []).find((u) => u.id === op.id);
  console.log("AFTER operations_count:", opAfter?.operations_count);

  const detail = await fetch(`${BASE}/api/${slug}/access/users/${op.id}/detail`, {
    headers: { Authorization: `Bearer ${adminTok}` }
  }).then(json);
  const matrix = detail.data?.matrix || [];
  const eff = matrix.filter((r) => r.effective).length;
  console.log("AFTER matrix effective rows:", eff, "total matrix:", matrix.length);

  const samples = [
    [`/api/${slug}/dashboard/sales?date_from=2026-01-01&date_to=2026-01-31`, 403]
  ];
  const apiResults = [];
  for (const [path, expect] of samples) {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${opTok}` } });
    apiResults.push({ path, status: r.status, expect });
    console.log("API", path.split("?")[0], "→", r.status, "(expect", expect + ")");
  }

  // Nav-critical keys must be gone (legacy aliases expanded on deny).
  const navCritical = [
    "orders.zakaz.view",
    "orders.view",
    "orders.zakaz.prosmotr_zakaza",
    "clients.klient.view",
    "clients.view",
    "clients.prosmotr_profilya_klienta",
    "work_slots.raboche_mesto.view",
    "dashboard.prodazhi.view",
    "dashboard.prodazhi"
  ];
  const navStill = navCritical.filter((k) => afterKeys.includes(k));
  console.log("nav-critical still present:", navStill.join(",") || "(none)");

  // Optional: orders/clients 403 only when RBAC_ENFORCE_PERMISSIONS=1
  for (const path of [`/api/${slug}/orders?limit=1`, `/api/${slug}/clients?limit=1`]) {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${opTok}` } });
    console.log("API (informational)", path.split("?")[0], "→", r.status);
  }

  if (RESTORE) {
    const restoreRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        merge_permissions: true,
        permissions: denySample,
        denied_permissions: []
      })
    });
    console.log("RESTORE status", restoreRes.status);
  } else {
    console.log("LEAVE_DENY: sample denies remain (set RESTORE=1 to restore those keys)");
  }

  const apiOk = apiResults.every((x) => x.status === x.expect);
  const ok =
    beforeGrants === 0 &&
    still.length === 0 &&
    afterKeys.length < beforeKeys.length &&
    countByPrefix(afterKeys, "access.grant.") === 0 &&
    (opAfter?.operations_count ?? -1) === afterKeys.length &&
    navStill.length === 0 &&
    apiOk;

  console.log(ok ? "VERIFY_PASS" : "VERIFY_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
