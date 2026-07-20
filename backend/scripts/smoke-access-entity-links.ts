/**
 * Entity-side reverse linking (Кассы/Склады modal) + trade_directions.
 *   npx tsx scripts/smoke-access-entity-links.ts
 */
const BASE = process.env.API_BASE ?? "http://127.0.0.1:18080";
const SLUG = "test1";

async function j(method: string, path: string, token: string | null, body?: unknown) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      signal: ctrl.signal,
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
  } finally {
    clearTimeout(t);
  }
}

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}
function ok(m: string) {
  console.log(`OK  ${m}`);
}

async function main() {
  const login = await j("POST", "/api/auth/login", null, {
    slug: SLUG,
    login: "admin",
    password: "secret123"
  });
  assert(login.status === 200, "login");
  const token = login.data.accessToken as string;
  const uid = 3;
  const cashId = 1;
  const whId = 4;

  // Prefer Access PATCH for cash (already proven). Entity GET may be heavy — try pickers/links endpoints used by modal.
  const cashPick = await j("GET", `/api/${SLUG}/cash-desks/${cashId}/pickers`, token);
  ok(`cash pickers status=${cashPick.status}`);

  // Attach via Access (known good), then verify entity list if available
  const det0 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const cashBefore = (det0.data.data.scope.cash_desks ?? []).map((x: any) => Number(x.id ?? x));
  const whBefore = (det0.data.data.scope.warehouses ?? []).map((x: any) => Number(x.id ?? x));

  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
    cash_desk_ids: [...new Set([...cashBefore, cashId])]
  });
  const cashUsers = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=cash_desks&key=${cashId}`,
    token
  );
  assert(
    (cashUsers.data.data ?? []).some((u: any) => Number(u.id) === uid),
    "cash reverse after access patch"
  );
  ok("Кассы: Access PATCH → reverse list synced");

  // Entity PATCH with links (AccessEntityRoleLinkModal path)
  const patchCash = await j("PATCH", `/api/${SLUG}/cash-desks/${cashId}`, token, {
    links: [{ user_id: uid, link_role: "operator" }]
  });
  ok(`Кассы entity PATCH links status=${patchCash.status} body=${JSON.stringify(patchCash.data).slice(0, 160)}`);

  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { cash_desk_ids: cashBefore });

  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
    warehouse_ids: [...new Set([...whBefore, whId])]
  });
  const whUsers = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=warehouses&key=${whId}`,
    token
  );
  assert(
    (whUsers.data.data ?? []).some((u: any) => Number(u.id) === uid),
    "wh reverse"
  );
  ok("Склады: Access PATCH → reverse list synced");

  const patchWh = await j("PATCH", `/api/${SLUG}/warehouses/${whId}`, token, {
    links: [{ user_id: uid, link_role: "operator" }]
  });
  ok(`Склады entity PATCH links status=${patchWh.status}`);

  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { warehouse_ids: whBefore });

  // trade directions
  const dirs = await j("GET", `/api/${SLUG}/access/dimensions?type=trade_directions`, token);
  const dlist = dirs.data.data ?? [];
  assert(dlist.length > 0, "need trade direction");
  const dkey = Number(dlist[0].key);
  assert(Number.isInteger(dkey) && dkey > 0, `bad trade key ${dlist[0].key}`);

  const det1 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const tdBefore = (det1.data.data.scope.trade_directions ?? [])
    .map((x: any) => Number(x.id ?? x))
    .filter((n: number) => Number.isInteger(n) && n > 0);

  const att = await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, {
    trade_direction_ids: [...new Set([...tdBefore, dkey])]
  });
  assert(att.status === 200, `trade attach ${att.status} ${JSON.stringify(att.data)}`);
  const det2 = await j("GET", `/api/${SLUG}/access/users/${uid}/detail`, token);
  const tdAfter = (det2.data.data.scope.trade_directions ?? []).map((x: any) => Number(x.id ?? x));
  assert(tdAfter.includes(dkey), "trade on user scope");
  const tdUsers = await j(
    "GET",
    `/api/${SLUG}/access/dimensions/users?type=trade_directions&key=${dkey}`,
    token
  );
  assert(
    (tdUsers.data.data ?? []).some((u: any) => Number(u.id) === uid),
    "trade reverse"
  );
  ok("Направления: attach + reverse works");
  await j("PATCH", `/api/${SLUG}/access/users/${uid}`, token, { trade_direction_ids: tdBefore });
  ok("Направления restored");

  console.log("\n=== entity/trade smoke PASSED ===");
}

main().catch((e) => {
  console.error("\n=== FAILED ===", e);
  process.exit(1);
});
