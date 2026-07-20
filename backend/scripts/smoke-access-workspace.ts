/**
 * Access (Доступ) smoke: operations grant/deny + cash/warehouse/territory + reverse dims.
 *   npx tsx scripts/smoke-access-workspace.ts
 */
const BASE = process.env.API_BASE ?? "http://127.0.0.1:18080";
const SLUG = process.env.TENANT_SLUG ?? "test1";

async function j(
  method: string,
  path: string,
  token: string | null,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
function ok(msg: string) {
  console.log(`OK  ${msg}`);
}
function note(msg: string) {
  console.log(`NOTE ${msg}`);
}

function idsFromScope(items: any[]): number[] {
  return (items ?? []).map((x) => Number(x.id ?? x)).filter((n) => Number.isFinite(n) && n > 0);
}

function userInList(list: any[], uid: number): boolean {
  return (list ?? []).some((u) => Number(u.id ?? u.user_id) === uid);
}

async function main() {
  const login = await j("POST", "/api/auth/login", null, {
    slug: SLUG,
    login: "admin",
    password: "secret123"
  });
  assert(login.status === 200, `admin login ${login.status}`);
  const token = login.data.accessToken as string;
  ok("admin login");

  const users = await j("GET", `/api/${SLUG}/access/users`, token);
  assert(users.status === 200, "users list");
  const list = (users.data.data ?? users.data) as any[];
  const operator =
    list.find((u) => u.role === "operator") ?? list.find((u) => u.login && u.login !== "admin");
  assert(operator, "need operator or non-admin user");
  const uid = Number(operator.id);
  ok(`target user: ${operator.login} id=${uid} role=${operator.role}`);

  const dimsOp = await j("GET", `/api/${SLUG}/access/dimensions?type=operations`, token);
  assert(dimsOp.status === 200, `dimensions operations ${dimsOp.status}`);
  const ops = (dimsOp.data.data ?? dimsOp.data) as any[];
  assert(Array.isArray(ops) && ops.length > 0, "ops nonempty");
  ok(`operations dimensions: ${ops.length}`);

  const TEST_KEY = "automation.zaiavki.view";
  ok(`test key present in dims: ${ops.some((o) => o.key === TEST_KEY)} (${TEST_KEY})`);

  const detail0 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  assert(detail0.status === 200, "detail0");
  const row0 = (detail0.data.data.matrix as any[]).find((r) => r.key === TEST_KEY);
  ok(
    `before effective=${!!row0?.effective} effect=${row0?.user_effect ?? "n/a"} from_role=${row0?.from_role ?? false}`
  );

  // GRANT
  const grant = await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
    merge_permissions: true,
    permissions: [TEST_KEY],
    denied_permissions: []
  });
  assert(grant.status === 200, `grant ${grant.status}`);
  const detail1 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const row1 = (detail1.data.data.matrix as any[]).find((r) => r.key === TEST_KEY);
  assert(row1?.effective === true, "after grant should be effective");
  ok("GRANT → effective=true");

  const dimUsers1 = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=operations&key=${encodeURIComponent(TEST_KEY)}`,
    token
  );
  assert(dimUsers1.status === 200, `dim users ${dimUsers1.status}`);
  const du1 = (dimUsers1.data.data ?? dimUsers1.data) as any[];
  assert(userInList(du1, uid), "user in reverse ops after grant");
  ok(`REVERSE ops includes user after grant (${du1.length} users)`);

  // DENY
  const deny = await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
    merge_permissions: true,
    permissions: [],
    denied_permissions: [TEST_KEY]
  });
  assert(deny.status === 200, "deny");
  const detail2 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const row2 = (detail2.data.data.matrix as any[]).find((r) => r.key === TEST_KEY);
  assert(row2?.effective === false, "after deny not effective");
  assert(row2?.user_effect === "deny", "user_effect deny");
  ok("DENY → effective=false");

  const dimUsers2 = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=operations&key=${encodeURIComponent(TEST_KEY)}`,
    token
  );
  const du2 = (dimUsers2.data.data ?? dimUsers2.data) as any[];
  assert(!userInList(du2, uid), "user NOT in reverse after deny");
  ok("REVERSE ops excludes user after deny");

  const clear = await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
    remove_permission_keys: [TEST_KEY]
  });
  assert(clear.status === 200, "clear override");
  ok("CLEAR override (remove_permission_keys) ok");

  // CASH
  const dimsCash = await j("GET", `/api/${SLUG}/access/dimensions?type=cash_desks`, token);
  assert(dimsCash.status === 200, "cash dims");
  const cashList = (dimsCash.data.data ?? dimsCash.data) as any[];
  assert(Array.isArray(cashList) && cashList.length > 0, `need cash desk, got ${cashList.length}`);
  const cashId = Number(cashList[0].id ?? cashList[0].key);
  ok(`cash desk id=${cashId}`);

  const dCash0 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const cashBefore = idsFromScope(dCash0.data.data.scope.cash_desks);
  const cashWith = Array.from(new Set([...cashBefore, cashId]));
  assert((await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { cash_desk_ids: cashWith })).status === 200, "attach cash");
  const dCash1 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  assert(idsFromScope(dCash1.data.data.scope.cash_desks).includes(cashId), "user scope has cash");
  ok("CASH attach (user→desk)");

  const cashUsers = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=cash_desks&key=${encodeURIComponent(String(cashId))}`,
    token
  );
  assert(cashUsers.status === 200, `cash reverse ${cashUsers.status}`);
  assert(userInList(cashUsers.data.data ?? cashUsers.data, uid), "user in cash reverse");
  ok("CASH reverse (desk→users)");

  assert(
    (
      await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
        cash_desk_ids: cashWith.filter((id) => id !== cashId)
      })
    ).status === 200,
    "detach cash"
  );
  const dCash2 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  assert(!idsFromScope(dCash2.data.data.scope.cash_desks).includes(cashId), "cash detached");
  const cashUsers2 = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=cash_desks&key=${encodeURIComponent(String(cashId))}`,
    token
  );
  assert(!userInList(cashUsers2.data.data ?? cashUsers2.data, uid), "user gone from cash reverse");
  ok("CASH detach both directions");
  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { cash_desk_ids: cashBefore });

  // WAREHOUSE
  const dimsWh = await j("GET", `/api/${SLUG}/access/dimensions?type=warehouses`, token);
  assert(dimsWh.status === 200, "wh dims");
  const whList = (dimsWh.data.data ?? dimsWh.data) as any[];
  assert(Array.isArray(whList) && whList.length > 0, "need warehouse");
  const whId = Number(whList[0].id ?? whList[0].key);
  ok(`warehouse id=${whId}`);

  const dWh0 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const whBefore = idsFromScope(dWh0.data.data.scope.warehouses);
  assert(
    (await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
      warehouse_ids: Array.from(new Set([...whBefore, whId]))
    })).status === 200,
    "attach wh"
  );
  const dWh1 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  assert(idsFromScope(dWh1.data.data.scope.warehouses).includes(whId), "wh on user");
  const whUsers = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=warehouses&key=${encodeURIComponent(String(whId))}`,
    token
  );
  assert(whUsers.status === 200, "wh reverse");
  assert(userInList(whUsers.data.data ?? whUsers.data, uid), "user in wh reverse");
  ok("WAREHOUSE attach + reverse");
  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { warehouse_ids: whBefore });
  ok("WAREHOUSE restored");

  // TERRITORY
  const terr = await j("GET", `/api/${SLUG}/access/territories`, token);
  assert(terr.status === 200, `territories ${terr.status}`);
  const flat =
    terr.data.data?.flat ?? terr.data.flat ?? (Array.isArray(terr.data.data) ? terr.data.data : terr.data);
  const terrArr = Array.isArray(flat) ? flat : [];
  ok(`territories catalog count≈${terrArr.length}`);
  if (terrArr.length > 0) {
    const tid = Number(terrArr[0].id ?? terrArr[0].territory_id);
    const dT0 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
    const tBefore = idsFromScope(dT0.data.data.scope.territories);
    assert(
      (await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
        territory_ids: Array.from(new Set([...tBefore, tid]))
      })).status === 200,
      "attach terr"
    );
    const dT1 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
    assert(idsFromScope(dT1.data.data.scope.territories).includes(tid), "terr on user");
    ok("TERRITORY attach (user→terr)");
    await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { territory_ids: tBefore });
    ok("TERRITORY restored");
  } else {
    note("no territories in catalog — skip attach");
  }

  const dimTerr = await j("GET", `/api/${SLUG}/access/dimensions?type=territories`, token);
  if (dimTerr.status === 200) {
    ok("TERRITORY reverse dimensions EXISTS");
  } else {
    note(`territories reverse tab yo‘q (status=${dimTerr.status}) — faqat xodim kartochkasidan`);
  }

  for (const t of ["branches", "payment_methods", "trade_directions"] as const) {
    const d = await j("GET", `/api/${SLUG}/access/dimensions?type=${t}`, token);
    const arr = d.data.data ?? d.data;
    ok(`dimension ${t}: status=${d.status} count=${Array.isArray(arr) ? arr.length : "?"}`);
    if (d.status === 200 && Array.isArray(arr) && arr.length > 0) {
      const key = String(arr[0].key ?? arr[0].id ?? arr[0].code);
      const u = await j(
        "GET",
        `/api/${SLUG}/access/dimensions/users?type=${t}&key=${encodeURIComponent(key)}`,
        token
      );
      ok(`  reverse ${t}: status=${u.status} count=${((u.data.data ?? u.data) as any[])?.length ?? 0}`);
    }
  }

  console.log("\n=== SUMMARY: Access grant/revoke + scopes smoke PASSED ===");
}

main().catch((e) => {
  console.error("\n=== FAILED ===");
  console.error(e);
  process.exit(1);
});
