/**
 * Smoke: Settings territory_nodes vs Access attach catalog + bind to Operator.
 *
 * Usage:
 *   node scripts/verify-access-territories-attach.mjs
 *
 * Requires API at http://127.0.0.1:18080, tenant test1, admin/operator seed.
 *
 * Env:
 *   API_BASE (default http://127.0.0.1:18080)
 *   ADMIN_PASSWORD (default secret123)
 *   OPERATOR_PASSWORD (tried: env, secret123, operator)
 *   ATTACH=1 — attach one territory to Operator and verify detail (default on)
 *   RESTORE=0 — leave operator territory binds after attach (default restores previous)
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:18080";
const slug = "test1";
const ATTACH = process.env.ATTACH !== "0";
const RESTORE = process.env.RESTORE !== "0";

async function json(res) {
  const t = await res.text();
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t, status: res.status };
  }
}

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

function countTerritoryNodes(nodes) {
  let n = 0;
  const walk = (list) => {
    for (const x of list || []) {
      n += 1;
      if (x.children?.length) walk(x.children);
    }
  };
  walk(nodes);
  return n;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function ok(msg) {
  console.log("OK:", msg);
}

async function main() {
  const adminPass = process.env.ADMIN_PASSWORD || "secret123";
  const adminTok = await login("admin", adminPass);
  const auth = { Authorization: `Bearer ${adminTok}` };

  const profileRes = await fetch(`${BASE}/api/${slug}/settings/profile`, { headers: auth });
  const profileBody = await json(profileRes);
  if (!profileRes.ok) fail(`settings/profile ${profileRes.status} ${JSON.stringify(profileBody).slice(0, 300)}`);
  const nodes = profileBody.references?.territory_nodes ?? profileBody.data?.references?.territory_nodes ?? [];
  const settingsCount = countTerritoryNodes(nodes);
  if (settingsCount <= 0) fail(`tenant has no territory_nodes in settings (count=${settingsCount})`);
  ok(`settings territory_nodes walk count=${settingsCount}`);

  const terrRes = await fetch(`${BASE}/api/${slug}/access/territories`, { headers: auth });
  const terrBody = await json(terrRes);
  if (!terrRes.ok) fail(`access/territories ${terrRes.status} ${JSON.stringify(terrBody).slice(0, 400)}`);
  const flat = Array.isArray(terrBody.data) ? terrBody.data : [];
  const tree = Array.isArray(terrBody.tree) ? terrBody.tree : [];
  if (flat.length <= 0) fail(`access/territories flat empty (settings has ${settingsCount})`);
  if (tree.length <= 0) fail(`access/territories tree empty (expected roots from settings)`);
  ok(`access/territories flat=${flat.length} treeRoots=${tree.length}`);

  // Spot-check other Access dimension pickers (same modal pattern).
  for (const type of ["warehouses", "branches", "payment_methods"]) {
    const dimRes = await fetch(`${BASE}/api/${slug}/access/dimensions?type=${type}`, { headers: auth });
    const dimBody = await json(dimRes);
    if (!dimRes.ok) fail(`dimensions ${type} ${dimRes.status}`);
    const rows = Array.isArray(dimBody.data) ? dimBody.data : [];
    if (rows.length <= 0) {
      console.warn(`WARN: dimensions ${type} count=0 (may be empty tenant refs)`);
    } else {
      ok(`dimensions ${type}=${rows.length}`);
    }
  }

  const usersRes = await fetch(`${BASE}/api/${slug}/access/users?include_counts=false`, { headers: auth });
  const usersBody = await json(usersRes);
  if (!usersRes.ok) fail(`access/users ${usersRes.status}`);
  const users = usersBody.data || [];
  const op = users.find((u) => u.login === "operator");
  if (!op) fail("operator user not found");
  ok(`operator id=${op.id}`);

  const detailBeforeRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}/detail`, { headers: auth });
  const detailBefore = await json(detailBeforeRes);
  if (!detailBeforeRes.ok) fail(`user detail ${detailBeforeRes.status}`);
  const prevTerritories = [...(detailBefore.data?.scope?.territories ?? [])].map(Number).filter((n) => n > 0);
  ok(`operator bound territories before=${prevTerritories.length}`);

  if (!ATTACH) {
    console.log("PASS (ATTACH=0, catalog-only)");
    return;
  }

  const attachId = Number(flat[0].id);
  if (!Number.isInteger(attachId) || attachId <= 0) fail(`invalid attach id from flat[0]=${JSON.stringify(flat[0])}`);

  const nextIds = [...new Set([...prevTerritories, attachId])];
  const patchRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
    method: "PATCH",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ territory_ids: nextIds })
  });
  const patchBody = await json(patchRes);
  if (!patchRes.ok) fail(`patch territory_ids ${patchRes.status} ${JSON.stringify(patchBody).slice(0, 400)}`);

  const detailAfterRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}/detail`, { headers: auth });
  const detailAfter = await json(detailAfterRes);
  const afterTerritories = (detailAfter.data?.scope?.territories ?? []).map(Number);
  if (!afterTerritories.includes(attachId)) {
    fail(`after bind missing territory ${attachId}; got ${afterTerritories.join(",")}`);
  }
  ok(`operator bound includes ${attachId} (total=${afterTerritories.length})`);

  if (RESTORE) {
    const restoreRes = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
      method: "PATCH",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ territory_ids: prevTerritories })
    });
    const restoreBody = await json(restoreRes);
    if (!restoreRes.ok) fail(`restore territory_ids ${restoreRes.status} ${JSON.stringify(restoreBody).slice(0, 300)}`);
    ok(`restored previous territory_ids (${prevTerritories.length})`);
  }

  console.log("PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
