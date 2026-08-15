/**
 * GPS monitoring API smoke test.
 *
 * Usage (API running on :18080):
 *   node scripts/test-gps-monitoring.mjs
 *
 * Env:
 *   API_BASE=http://127.0.0.1:18080
 *   SLUG=test1
 *   LOGIN=admin
 *   PASSWORD=secret123
 */
const API_BASE = (process.env.API_BASE || "http://127.0.0.1:18080").replace(/\/$/, "");
const SLUG = process.env.SLUG || "test1";
const LOGIN = process.env.LOGIN || "admin";
const PASSWORD = process.env.PASSWORD || "secret123";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function req(path, { method = "GET", token, body, query } = {}) {
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(
      `API ga ulanib bo‘lmadi (${url.origin}): ${why}. Avval npm run dev:quick yoki .\\start-dev.cmd ni ishga tushiring.`
    );
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log(`[test-gps-monitoring] ${API_BASE} slug=${SLUG}`);

  const login = await req("/api/auth/login", {
    method: "POST",
    body: { slug: SLUG, login: LOGIN, password: PASSWORD }
  });
  assert(login.ok, `login failed: ${login.status} ${JSON.stringify(login.json)}`);
  const token = login.json.accessToken || login.json.access_token;
  assert(token, "accessToken missing");

  const date = todayIso();

  const emp = await req(`/api/${SLUG}/gps-monitoring/employees`, {
    token,
    query: { date }
  });
  assert(emp.ok, `employees failed: ${emp.status} ${JSON.stringify(emp.json)}`);
  const employees = emp.json?.data?.employees ?? [];
  assert(Array.isArray(employees), "employees not array");
  assert(employees.length > 0, "employees empty — run seed:gps-monitoring");
  console.log(`  employees: ${employees.length}`);

  const agent =
    employees.find((e) => e.type === "agent") ||
    employees.find((e) => e.type !== "supervisor") ||
    employees[0];
  assert(agent, "no employee to test day");

  const day = await req(`/api/${SLUG}/gps-monitoring/day`, {
    token,
    query: { employee_id: agent.id, date }
  });
  assert(day.ok, `day failed: ${day.status} ${JSON.stringify(day.json)}`);
  const points = day.json?.data?.points ?? [];
  const track = day.json?.data?.track ?? [];
  assert(Array.isArray(points), "points not array");
  assert(Array.isArray(track), "track not array");
  console.log(`  day points=${points.length} track=${track.length} employee=${agent.code}`);

  const statuses = new Set(points.map((p) => p.status));
  console.log(`  statuses: ${[...statuses].join(", ") || "(none)"}`);

  // Line / route line prerequisites
  const visitedPts = points.filter((p) => p.arrived != null);
  assert(
    track.length > 1 || visitedPts.length > 1 || points.length === 0,
    "GPS линия/маршрут uchun track yoki visited points yetarli emas (seed kerak)"
  );
  if (track.length > 1) {
    assert(
      track.every(
        (c) =>
          c &&
          typeof c === "object" &&
          Number.isFinite(c.lat) &&
          Number.isFinite(c.lng) &&
          Number.isFinite(c.hour)
      ),
      "track coords invalid"
    );
    console.log(`  GPS линия (track): ${track.length} nuqta — OK`);
  }
  if (visitedPts.length > 1) {
    console.log(`  Линия маршрута (visited): ${visitedPts.length} nuqta — OK`);
  }

  const overview = await req(`/api/${SLUG}/gps-monitoring/overview`, { token });
  assert(overview.ok, `overview failed: ${overview.status}`);
  const clusters = overview.json?.data?.clusters ?? [];
  assert(Array.isArray(clusters), "clusters not array");
  console.log(`  overview clusters: ${clusters.length}`);

  const trading = await req(`/api/${SLUG}/gps-monitoring/trading-points`, {
    token,
    query: { limit: 20 }
  });
  assert(trading.ok, `trading failed: ${trading.status}`);
  const tpoints = trading.json?.data?.points ?? [];
  assert(Array.isArray(tpoints), "trading points not array");
  console.log(`  trading points: ${tpoints.length}`);

  // Soft assertions for seeded agent day richness
  if (points.length > 0) {
    assert(points.every((p) => typeof p.lat === "number" && typeof p.lng === "number"), "point coords");
    assert(points.every((p) => typeof p.index === "number"), "point index");
  }

  console.log("[test-gps-monitoring] OK");
}

main().catch((e) => {
  console.error("[test-gps-monitoring] FAIL", e.message || e);
  process.exitCode = 1;
});
