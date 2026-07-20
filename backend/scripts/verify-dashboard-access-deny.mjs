/**
 * Smoke: deny Operator dashboard ops → me-permissions has no dashboard.* + dashboard API 403.
 * Usage: node scripts/verify-dashboard-access-deny.mjs
 * Requires API at http://127.0.0.1:18080, tenant test1, admin/operator seed.
 *
 * Env:
 *   OPERATOR_PASSWORD (default operator)
 *   RESTORE=1 — after PASS, restore dashboard grants (default: leave deny in place)
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:18080";
const slug = "test1";
const RESTORE = process.env.RESTORE === "1";

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t, status: res.status };
  }
}

const OPERATOR_PASSWORDS = [process.env.OPERATOR_PASSWORD, "secret123", "operator"].filter(Boolean);

async function login(loginName, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, login: loginName, password })
  });
  const body = await json(res);
  if (!res.ok) {
    throw new Error(`login failed ${loginName} ${res.status} ${JSON.stringify(body)}`);
  }
  return body.accessToken || body.access_token || body.data?.accessToken;
}

async function loginOperator() {
  let lastErr;
  for (const pw of OPERATOR_PASSWORDS) {
    try {
      return await login("operator", pw);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("operator login failed");
}

function dashKeys(keys) {
  return keys.filter((k) => k.startsWith("dashboard."));
}

const structured = [
  "dashboard.prodazhi.view",
  "dashboard.finansy.view",
  "dashboard.supervayzer.view",
  "dashboard.plan_fakt.view"
];
const legacy = [
  "dashboard.prodazhi",
  "dashboard.finansy",
  "dashboard.supervayzer",
  "dashboard.plan_fakt",
  "dashboard.view"
];
/** Structured section ops — expandPermissionKeyAliases also adds legacy + dashboard.view. */
const denyAll = [
  "dashboard.prodazhi.view",
  "dashboard.prodazhi.copy",
  "dashboard.finansy.view",
  "dashboard.finansy.copy",
  "dashboard.supervayzer.view",
  "dashboard.supervayzer.copy",
  "dashboard.plan_fakt.view",
  "dashboard.plan_fakt.copy"
];

async function main() {
  const adminTok = await login("admin", "secret123");
  const opTok = await loginOperator();

  const usersRes = await fetch(`${BASE}/api/${slug}/access/users?include_counts=false`, {
    headers: { Authorization: `Bearer ${adminTok}` }
  });
  const usersBody = await json(usersRes);
  const users = usersBody.data || usersBody;
  const op = (Array.isArray(users) ? users : []).find(
    (u) => u.login === "operator" || (u.name && String(u.name).includes("Operator"))
  );
  if (!op) throw new Error(`operator user not found: ${JSON.stringify(usersBody).slice(0, 400)}`);
  console.log("operator id=", op.id, "login=", op.login, "name=", op.name);

  const meBefore = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${opTok}` }
  }).then(json);
  const beforeKeys = meBefore.data?.keys || [];
  console.log("BEFORE dashboard keys:", dashKeys(beforeKeys).sort().join(", ") || "(none)");

  const patchRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ merge_permissions: true, denied_permissions: denyAll })
  });
  const patchBody = await json(patchRes);
  console.log("PATCH status", patchRes.status, patchRes.ok ? "ok" : JSON.stringify(patchBody).slice(0, 300));

  const meAfter = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${opTok}` }
  }).then(json);
  const afterKeys = meAfter.data?.keys || [];
  const afterDash = dashKeys(afterKeys);
  console.log("AFTER dashboard keys:", afterDash.sort().join(", ") || "(none)");

  const stillStructured = structured.filter((k) => afterKeys.includes(k));
  const stillSectionLegacy = legacy
    .filter((k) => k !== "dashboard.view")
    .filter((k) => afterKeys.includes(k));
  const stillView = afterKeys.includes("dashboard.view");
  console.log("still structured:", stillStructured.join(",") || "(none)");
  console.log("still section legacy:", stillSectionLegacy.join(",") || "(none)");
  console.log("dashboard.view still present:", stillView);

  const mon = await fetch(
    `${BASE}/api/${slug}/dashboard/sales-monitoring?date_from=2026-01-01&date_to=2026-01-31`,
    { headers: { Authorization: `Bearer ${opTok}` } }
  );
  console.log("sales-monitoring status", mon.status);

  const sales = await fetch(
    `${BASE}/api/${slug}/dashboard/sales?date_from=2026-01-01&date_to=2026-01-31`,
    { headers: { Authorization: `Bearer ${opTok}` } }
  );
  console.log("sales status", sales.status);

  const finance = await fetch(
    `${BASE}/api/${slug}/dashboard/finance?date_from=2026-01-01&date_to=2026-01-31`,
    { headers: { Authorization: `Bearer ${opTok}` } }
  );
  console.log("finance status", finance.status);

  // Simulate Access UI «Снять» on role+allow (must deny, not remove-only).
  const uiRevokeRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      merge_permissions: true,
      permissions: ["dashboard.supervayzer.view"],
      denied_permissions: []
    })
  });
  console.log("UI-sim allow overlay status", uiRevokeRes.status);
  const afterAllow = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${opTok}` }
  }).then(json);
  const hasAfterAllow = (afterAllow.data?.keys || []).includes("dashboard.supervayzer.view");
  console.log("after allow overlay supervayzer.view:", hasAfterAllow);

  const denyAgain = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ merge_permissions: true, denied_permissions: ["dashboard.supervayzer.view"] })
  });
  console.log("UI-sim deny (Снять) status", denyAgain.status);
  const afterDenyUi = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
    headers: { Authorization: `Bearer ${opTok}` }
  }).then(json);
  const stillAfterUiDeny = (afterDenyUi.data?.keys || []).includes("dashboard.supervayzer.view");
  console.log("after UI deny supervayzer.view:", stillAfterUiDeny);

  if (RESTORE) {
    const restore = [
      ...structured,
      ...legacy,
      "dashboard.prodazhi.copy",
      "dashboard.finansy.copy",
      "dashboard.supervayzer.copy",
      "dashboard.plan_fakt.copy"
    ];
    const restoreRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminTok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ merge_permissions: true, permissions: restore, denied_permissions: [] })
    });
    console.log("RESTORE status", restoreRes.status);
    const meRestored = await fetch(`${BASE}/api/${slug}/access/me-permissions`, {
      headers: { Authorization: `Bearer ${opTok}` }
    }).then(json);
    console.log(
      "RESTORED dashboard sample:",
      dashKeys(meRestored.data?.keys || [])
        .filter((k) => k.includes("prodazhi") || k === "dashboard.view")
        .sort()
        .join(", ")
    );
  } else {
    console.log("LEAVE_DENY: operator keeps dashboard denies (set RESTORE=1 to restore)");
  }

  const ok =
    stillStructured.length === 0 &&
    stillSectionLegacy.length === 0 &&
    !stillView &&
    afterDash.length === 0 &&
    mon.status === 403 &&
    sales.status === 403 &&
    finance.status === 403 &&
    hasAfterAllow === true &&
    stillAfterUiDeny === false;
  console.log(ok ? "VERIFY_PASS" : "VERIFY_FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
