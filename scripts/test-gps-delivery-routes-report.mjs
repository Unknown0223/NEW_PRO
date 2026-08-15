/**
 * Smoke: GPS delivery routes report + Excel export.
 *   node scripts/test-gps-delivery-routes-report.mjs
 */
const API_BASE = (process.env.API_BASE || "http://127.0.0.1:18080").replace(/\/$/, "");
const SLUG = process.env.SLUG || "test1";
const LOGIN = process.env.LOGIN || "admin";
const PASSWORD = process.env.PASSWORD || "secret123";

async function req(path, { method = "GET", token, body, query, blob } = {}) {
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers = { Accept: blob ? "*/*" : "application/json" };
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
    throw new Error(`API offline (${url.origin}): ${e instanceof Error ? e.message : e}`);
  }
  if (blob) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, status: res.status, buf, headers: res.headers };
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

function monthRange() {
  const t = new Date();
  const y = t.getFullYear();
  const m = t.getMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

async function main() {
  console.log(`[test-gps-delivery-routes] ${API_BASE}`);
  const login = await req("/api/auth/login", {
    method: "POST",
    body: { slug: SLUG, login: LOGIN, password: PASSWORD }
  });
  assert(login.ok, `login ${login.status}`);
  const token = login.json.accessToken || login.json.access_token;
  assert(token, "no token");

  const { from, to } = monthRange();

  const opts = await req(`/api/${SLUG}/reports/gps-delivery-routes/filter-options`, { token });
  assert(opts.ok, `filter-options ${opts.status}`);
  assert(Array.isArray(opts.json?.data?.expeditors), "expeditors missing");
  console.log(`  expeditors=${opts.json.data.expeditors.length} branches=${opts.json.data.branches.length}`);

  const report = await req(`/api/${SLUG}/reports/gps-delivery-routes`, {
    token,
    query: { from, to, page: 1, limit: 10 }
  });
  assert(report.ok, `report ${report.status} ${JSON.stringify(report.json)}`);
  const rows = report.json?.data?.rows ?? [];
  assert(Array.isArray(rows), "rows");
  console.log(`  rows=${rows.length} total=${report.json.data.total}`);

  const appOnly = await req(`/api/${SLUG}/reports/gps-delivery-routes`, {
    token,
    query: { from, to, page: 1, limit: 50, app_users_only: "1" }
  });
  assert(appOnly.ok, `app_users_only ${appOnly.status}`);
  console.log(`  app_users_only total=${appOnly.json.data.total}`);

  const exp = await req(`/api/${SLUG}/reports/gps-delivery-routes/export`, {
    token,
    query: { from, to },
    blob: true
  });
  assert(exp.ok, `export ${exp.status}`);
  assert(exp.buf.length > 100, "xlsx too small");
  // xlsx zip magic PK
  assert(exp.buf[0] === 0x50 && exp.buf[1] === 0x4b, "not xlsx zip");

  let XLSX = null;
  try {
    const { createRequire } = await import("module");
    const req = createRequire(import.meta.url);
    XLSX = req("../backend/node_modules/xlsx");
  } catch {
    XLSX = null;
  }
  if (rows[0] && XLSX) {
    const wb = XLSX.read(exp.buf, { type: "buffer", cellNF: true });
    const sh = wb.Sheets[wb.SheetNames[0]];
    const c2 = sh.C2;
    const e2 = sh.E2;
    assert(c2 && c2.t === "n" && c2.z === "[h]:mm:ss", `time fmt ${JSON.stringify(c2)}`);
    assert(e2 && e2.t === "n" && e2.z === "0.000", `km fmt ${JSON.stringify(e2)}`);
    const expectedDur = rows[0].actual_time_sec / 86400;
    assert(Math.abs(c2.v - expectedDur) < 1e-9, `time value ${c2.v} vs ${expectedDur}`);
    const expectedKm = Math.round((rows[0].calculated_route_m / 1000) * 1000) / 1000;
    assert(Math.abs(e2.v - expectedKm) < 1e-9, `km value ${e2.v} vs ${expectedKm}`);
    console.log(`  excel time=${c2.w || c2.v} km=${e2.w || e2.v} — OK`);
  } else {
    console.log(`  excel bytes=${exp.buf.length} — OK`);
  }
  console.log("[test-gps-delivery-routes] OK");
}

main().catch((e) => {
  console.error("[test-gps-delivery-routes] FAIL", e.message || e);
  process.exitCode = 1;
});
