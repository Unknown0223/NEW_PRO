/**
 * Smoke: Access cash-desk / warehouse / trade-direction directory scope for Operator vs Admin.
 *
 * Usage:
 *   node scripts/verify-access-directory-scope.mjs
 *
 * Requires API at http://127.0.0.1:18080, tenant test1.
 * Operator password: OPERATOR_PASSWORD or secret123 / operator.
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:18080";
const slug = "test1";

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const adminTok = await login("admin", "secret123");
  const opTok = await loginOperator();
  const ah = { Authorization: `Bearer ${adminTok}` };
  const oh = { Authorization: `Bearer ${opTok}` };

  const usersRes = await fetch(`${BASE}/api/${slug}/access/users?include_counts=true`, { headers: ah });
  const usersBody = await json(usersRes);
  const users = usersBody.data || usersBody;
  const op = (Array.isArray(users) ? users : []).find(
    (u) => u.login === "operator" || (u.name && String(u.name).includes("Operator"))
  );
  assert(op, `operator user not found`);
  const linkedFromUser = op.scope?.cash_desks ?? op.cash_desks ?? op.cash_desk_ids ?? [];
  console.log("operator id=", op.id, "role=", op.role, "cash_desks=", linkedFromUser);

  const desksAdmin = await json(
    await fetch(`${BASE}/api/${slug}/cash-desks?limit=200`, { headers: ah })
  );
  const adminRows = desksAdmin.data || [];
  assert(adminRows.length >= 1, `admin should see cash desks, got ${adminRows.length}`);
  console.log("admin cash-desks total=", desksAdmin.total ?? adminRows.length, "names=", adminRows.map((d) => d.name).join(", "));

  const linked = Array.isArray(linkedFromUser) ? linkedFromUser : [];

  // Ensure operator has exactly one cash desk for a clean assertion when possible.
  let expectedIds = linked.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (expectedIds.length === 0 && adminRows.length > 0) {
    const pick = adminRows.find((d) => String(d.name).toLowerCase().includes("sergeli")) ?? adminRows[0];
    const patch = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
      method: "PATCH",
      headers: { ...ah, "Content-Type": "application/json" },
      body: JSON.stringify({ cash_desk_ids: [pick.id] })
    });
    assert(patch.ok, `failed to attach cash desk: ${patch.status} ${JSON.stringify(await json(patch))}`);
    expectedIds = [pick.id];
    console.log("attached cash_desk_ids=", expectedIds, "name=", pick.name);
  } else if (expectedIds.length > 1) {
    const sergeli = adminRows.find((d) => String(d.name).toLowerCase().includes("sergeli"));
    if (sergeli) {
      const patch = await fetch(`${BASE}/api/${slug}/access/users/${op.id}`, {
        method: "PATCH",
        headers: { ...ah, "Content-Type": "application/json" },
        body: JSON.stringify({ cash_desk_ids: [sergeli.id] })
      });
      assert(patch.ok, `failed to narrow cash desks`);
      expectedIds = [sergeli.id];
      console.log("narrowed operator to sergeli id=", sergeli.id);
    }
  }

  const desksOp = await json(
    await fetch(`${BASE}/api/${slug}/cash-desks?limit=200`, { headers: oh })
  );
  const opRows = desksOp.data || [];
  const opTotal = desksOp.total ?? opRows.length;
  console.log("operator cash-desks total=", opTotal, "names=", opRows.map((d) => d.name).join(", "));
  assert(opTotal === expectedIds.length, `operator cash desk count ${opTotal} !== ${expectedIds.length}`);
  for (const row of opRows) {
    assert(expectedIds.includes(row.id), `unexpected desk ${row.id} ${row.name}`);
  }

  const unbound = adminRows.find((d) => !expectedIds.includes(d.id));
  if (unbound) {
    const one = await fetch(`${BASE}/api/${slug}/cash-desks/${unbound.id}`, { headers: oh });
    assert(one.status === 404, `unbound cash desk get should 404, got ${one.status}`);
    console.log("unbound get-by-id → 404 ok id=", unbound.id);
  }

  const whAdmin = await json(await fetch(`${BASE}/api/${slug}/warehouses/table?limit=200`, { headers: ah }));
  const whOp = await json(await fetch(`${BASE}/api/${slug}/warehouses/table?limit=200`, { headers: oh }));
  console.log("warehouses admin total=", whAdmin.total, "operator total=", whOp.total);

  const tdAdmin = await json(await fetch(`${BASE}/api/${slug}/trade-directions`, { headers: ah }));
  const tdOp = await json(await fetch(`${BASE}/api/${slug}/trade-directions`, { headers: oh }));
  const tdAdminN = (tdAdmin.data || []).length;
  const tdOpN = (tdOp.data || []).length;
  console.log("trade-directions admin=", tdAdminN, "operator=", tdOpN);
  assert(tdOpN <= tdAdminN, "operator trade directions should not exceed admin");

  // Role check: operator token must not be admin
  const me = await json(await fetch(`${BASE}/api/${slug}/access/me-permissions`, { headers: oh }));
  const role = me.data?.role || me.role;
  if (role) {
    assert(role !== "admin", `operator session role is admin — wrong user`);
    console.log("operator session role=", role);
  }

  console.log("PASS verify-access-directory-scope");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
