#!/usr/bin/env node
/**
 * Lokal to‘liq smoke: health, login, asosiy API, audit tuzatishlar, web sahifalar, mobil.
 *
 *   node scripts/local-full-smoke.mjs
 *
 * Env (ixtiyoriy):
 *   API_BASE=http://127.0.0.1:18080
 *   WEB_BASE=http://127.0.0.1:3010   (bo‘lmasa 3000/3010/3001 avtomatik)
 *   SLUG=test1
 *
 * Demo loginlar seed-test1 dan (admin/operator/agent). Ishlab chiqarish parolini o‘qimaydi.
 */
const API_BASE = (process.env.API_BASE || "http://127.0.0.1:18080").replace(/\/$/, "");
const SLUG = process.env.SLUG || "test1";
const OTHER_SLUG = process.env.OTHER_SLUG || "demo";

const SEED_ADMIN = {
  login: process.env.LOGIN || "admin",
  password: process.env.PASSWORD || "secret123"
};
const SEED_OPERATOR = { login: "operator", password: "secret123" };
const SEED_AGENT = { login: "agent", password: "111111" };

const REFRESH_COOKIE = "salec_rt";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 25000);

/** @typedef {{ name: string, status: "OK"|"FAIL"|"SKIP", http?: number, reason?: string }} Row */

/** @type {Row[]} */
const rows = [];

function ok(name, http, reason) {
  rows.push({ name, status: "OK", http, reason });
}
function fail(name, http, reason) {
  rows.push({ name, status: "FAIL", http, reason });
}
function skip(name, reason) {
  rows.push({ name, status: "SKIP", reason });
}

function parseCookie(setCookieHeaders, name) {
  for (const raw of setCookieHeaders) {
    const part = String(raw).split(";")[0] ?? "";
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return "";
}

async function request(base, path, opts = {}) {
  const url = new URL((path.startsWith("http") ? path : base + path));
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers = { ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.cookie) headers.Cookie = opts.cookie;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: opts.method || "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      redirect: opts.redirect || "manual",
      signal: ac.signal
    });
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : String(e);
    throw Object.assign(new Error(msg), { network: true, url: String(url) });
  }
  clearTimeout(t);
  const setCookie =
    typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return {
    status: res.status,
    headers: res.headers,
    setCookie,
    text,
    json,
    location: res.headers.get("location") || ""
  };
}

function expectOk(name, res, allow = [200]) {
  if (allow.includes(res.status)) {
    ok(name, res.status, res.json?.error ? String(res.json.error) : undefined);
    return true;
  }
  fail(
    name,
    res.status,
    res.json?.error || res.json?.message || res.text.slice(0, 180) || "unexpected status"
  );
  return false;
}

async function loginSeed(who, creds) {
  const res = await request(API_BASE, "/auth/login", {
    method: "POST",
    body: {
      slug: SLUG,
      login: creds.login,
      password: creds.password,
      device_name: `local-smoke-${who}`,
      device_id: `smoke-${who}-001`
    }
  });
  const token = res.json?.accessToken || "";
  const cookie = parseCookie(res.setCookie, REFRESH_COOKIE);
  return { res, token, cookie, role: res.json?.user?.role, login: creds.login };
}

async function sectionHealth() {
  try {
    const h = await request(API_BASE, "/health");
    expectOk("health", h, [200]);
  } catch (e) {
    fail("health", 0, e instanceof Error ? e.message : String(e));
    return false;
  }
  try {
    const r = await request(API_BASE, "/ready");
    if (r.status === 200) ok("ready", 200, r.json?.status || "ready");
    else if (r.status === 401) skip("ready", "x-internal-token talab qilinadi (lokal himoya)");
    else if (r.status === 503) fail("ready", 503, JSON.stringify(r.json || {}).slice(0, 200));
    else fail("ready", r.status, r.text.slice(0, 180));
  } catch (e) {
    fail("ready", 0, e instanceof Error ? e.message : String(e));
  }
  return rows.some((x) => x.name === "health" && x.status === "OK");
}

async function sectionLogin() {
  let admin;
  try {
    admin = await loginSeed("admin", SEED_ADMIN);
  } catch (e) {
    fail("login-admin", 0, e instanceof Error ? e.message : String(e));
    return { admin: null, agent: null, operator: null };
  }
  if (admin.res.status !== 200 || !admin.token) {
    const err = admin.res.json?.error || admin.res.text.slice(0, 180);
    fail("login-admin", admin.res.status, err);
    return { admin: null, agent: null, operator: null };
  }
  ok("login-admin", 200, `role=${admin.role || "?"}`);

  if (admin.cookie) ok("login-set-cookie-salec_rt", 200, "HttpOnly cookie o‘rnatildi");
  else fail("login-set-cookie-salec_rt", admin.res.status, "Set-Cookie salec_rt yo‘q");

  const me = await request(API_BASE, "/auth/me", { token: admin.token });
  expectOk("auth-me", me, [200]);

  let operator = null;
  try {
    operator = await loginSeed("operator", SEED_OPERATOR);
    if (operator.res.status === 200 && operator.token) ok("login-operator", 200, "seed/demo login");
    else skip("login-operator", `${operator.res.status} ${operator.res.json?.error || ""}`.trim());
  } catch (e) {
    skip("login-operator", e instanceof Error ? e.message : String(e));
    operator = null;
  }

  let agent = null;
  try {
    agent = await loginSeed("agent", SEED_AGENT);
    if (agent.res.status === 200 && agent.token) ok("login-agent", 200, "seed/demo login");
    else skip("login-agent", `${agent.res.status} ${agent.res.json?.error || ""}`.trim());
  } catch (e) {
    skip("login-agent", e instanceof Error ? e.message : String(e));
    agent = null;
  }

  return { admin, agent, operator };
}

async function sectionRefreshCookie(admin) {
  if (!admin?.cookie) {
    skip("auth-refresh-cookie", "salec_rt cookie yo‘q");
    return;
  }
  const res = await request(API_BASE, "/auth/refresh", {
    method: "POST",
    cookie: `${REFRESH_COOKIE}=${encodeURIComponent(admin.cookie)}`,
    body: {}
  });
  if (res.status === 200 && res.json?.accessToken) {
    ok("auth-refresh-cookie", 200, "body refreshToken yo‘q, cookie bilan 30 kunlik sessiya");
  } else {
    fail(
      "auth-refresh-cookie",
      res.status,
      res.json?.error || "cookie orqali yangilanmadi"
    );
  }
}

async function getAuth(token, path, name, allow = [200]) {
  const res = await request(API_BASE, path, { token });
  expectOk(name, res, allow);
  return res;
}

async function sectionAdminApis(token) {
  const from = "2026-01-01";
  const to = "2026-12-31";
  const list = [
    [`/api/${SLUG}/dashboard/stats`, "dashboard-stats"],
    [`/api/${SLUG}/dashboard/meta`, "dashboard-meta"],
    [`/api/${SLUG}/orders?page=1&limit=5`, "orders-list"],
    [`/api/${SLUG}/clients?page=1&limit=5`, "clients-list"],
    [`/api/${SLUG}/payments?page=1&limit=5`, "payments-list"],
    [`/api/${SLUG}/stock`, "stock-list"],
    [`/api/${SLUG}/reports/sales?from=${from}&to=${to}`, "reports-sales"],
    [`/api/${SLUG}/reports/gps-delivery-routes/filter-options`, "reports-gps-filters"],
    [`/api/${SLUG}/agents?page=1&limit=5`, "staff-agents"],
    [`/api/${SLUG}/users`, "staff-users"],
    [`/api/${SLUG}/access/me-permissions`, "access-me-permissions"],
    [`/api/${SLUG}/work-slots`, "work-slots"],
    [`/api/${SLUG}/cash-desks`, "cash-desks"],
    [`/api/${SLUG}/products?page=1&limit=5`, "products-list"],
    [`/api/${SLUG}/plans/daily-kpi?day=2026-08-15`, "plans-daily-kpi"],
    [`/api/${SLUG}/plans/approvers/options`, "plans-approvers"],
    [`/api/${SLUG}/consignment/settings`, "consignment-settings"],
    [`/api/${SLUG}/notifications?limit=5`, "notifications"],
    [`/api/${SLUG}/protected`, "protected"]
  ];
  for (const [path, name] of list) {
    try {
      await getAuth(token, path, name, [200]);
    } catch (e) {
      fail(name, 0, e instanceof Error ? e.message : String(e));
    }
  }
}

async function sectionRbac(agent, rbacHint) {
  if (!agent?.token) {
    skip("rbac-agent-delete-order", "agent login yo‘q");
    skip("rbac-agent-payments", "agent login yo‘q");
    return;
  }
  const del = await request(API_BASE, `/api/${SLUG}/orders/1`, {
    method: "DELETE",
    token: agent.token
  });
  const code = del.json?.error || "";
  if ([401, 403].includes(del.status)) {
    ok("rbac-agent-delete-order", del.status, `${code || "ruxsat yo‘q"} (${rbacHint})`);
  } else if (del.status === 404) {
    ok(
      "rbac-agent-delete-order",
      404,
      `marshrut/zakaz yo‘q yoki ruxsat guard oldin ishlamadi (${rbacHint})`
    );
  } else if ([200, 204].includes(del.status)) {
    fail("rbac-agent-delete-order", del.status, "past huquqli user zakazni o‘chira oldi");
  } else {
    fail("rbac-agent-delete-order", del.status, code || del.text.slice(0, 120));
  }

  const pay = await request(API_BASE, `/api/${SLUG}/payments?page=1&limit=1`, {
    token: agent.token
  });
  if ([401, 403].includes(pay.status)) {
    ok("rbac-agent-payments", pay.status, pay.json?.error || "agent to‘lovlar ro‘yxatiga kira olmaydi");
  } else if (pay.status === 200) {
    fail("rbac-agent-payments", 200, "agent to‘lovlar ro‘yxatini oldi");
  } else {
    skip("rbac-agent-payments", `${pay.status} ${pay.json?.error || ""}`.trim());
  }
}

async function sectionTenantIsolation(admin) {
  if (!admin?.token) {
    skip("tenant-isolation", "admin token yo‘q");
    return;
  }
  const res = await request(API_BASE, `/api/${OTHER_SLUG}/orders?page=1&limit=1`, {
    token: admin.token
  });
  if (res.status === 403) {
    ok("tenant-isolation", 403, res.json?.error || "CrossTenantDenied");
  } else if (res.status === 404) {
    ok("tenant-isolation", 404, `${OTHER_SLUG} topilmadi yoki rad etildi`);
  } else {
    fail("tenant-isolation", res.status, "boshqa slug bilan ruxsat berildi");
  }
}

async function sectionWebVitals() {
  const nonsense = `/totally-unknown-path-${Date.now()}-${Math.random().toString(36).slice(2)}/${"x".repeat(80)}`;
  const res = await request(API_BASE, `/api/${SLUG}/metrics/web-vitals`, {
    method: "POST",
    body: { name: "LCP", value: 1.23, path: nonsense }
  });
  if ([204, 400].includes(res.status)) {
    ok("web-vitals-unauth", res.status, "auth yo‘q; g‘alati yo‘l portlamadi");
  } else if (res.status === 401) {
    fail("web-vitals-unauth", 401, "web-vitals auth talab qilmasligi kerak");
  } else if (res.status === 429) {
    skip("web-vitals-unauth", "rate limit (1 daqiqada 60)");
  } else {
    fail("web-vitals-unauth", res.status, res.json?.error || res.text.slice(0, 120));
  }
}

async function sectionMobilePublic() {
  const rel = await request(API_BASE, "/api/mobile/app-release", {
    query: { slug: SLUG, version: "3.0.0", platform: "android" }
  });
  expectOk("mobile-app-release", rel, [200]);

  const apk = await request(API_BASE, "/api/mobile/apk-download", {
    query: { slug: SLUG },
    timeoutMs: 15000
  });
  if (apk.status === 200) ok("mobile-apk-download", 200, "APK bor");
  else if (apk.status === 404) skip("mobile-apk-download", "APK hali yuklanmagan");
  else fail("mobile-apk-download", apk.status, apk.json?.error || apk.text.slice(0, 120));
}

async function sectionMobileAgent(agent) {
  if (!agent?.token) {
    skip("mobile-me-profile", "agent login yo‘q");
    skip("mobile-agent-dashboard", "agent login yo‘q");
    skip("mobile-sync-full", "agent login yo‘q");
    skip("mobile-presence", "agent login yo‘q");
    return;
  }
  await getAuth(agent.token, `/api/${SLUG}/mobile/me/profile`, "mobile-me-profile", [200]);
  await getAuth(agent.token, `/api/${SLUG}/mobile/agent-dashboard`, "mobile-agent-dashboard", [200]);

  const presence = await request(API_BASE, `/api/${SLUG}/mobile/presence`, {
    method: "POST",
    token: agent.token,
    body: { device_name: "smoke-device", apk_version: "3.0.0" }
  });
  expectOk("mobile-presence", presence, [200]);

  try {
    const sync = await request(API_BASE, `/api/${SLUG}/mobile/sync/full`, {
      method: "POST",
      token: agent.token,
      body: { last_sync_at: null, apk_version: "3.0.0" },
      timeoutMs: 60000
    });
    expectOk("mobile-sync-full", sync, [200]);
  } catch (e) {
    fail("mobile-sync-full", 0, e instanceof Error ? e.message : String(e));
  }
}

async function resolveWebBase() {
  if (process.env.WEB_BASE) return process.env.WEB_BASE.replace(/\/$/, "");
  for (const port of [3000, 3010, 3001, 3002]) {
    const base = `http://127.0.0.1:${port}`;
    try {
      const res = await request(base, "/login", { redirect: "manual", timeoutMs: 4000 });
      if (![200, 302, 307].includes(res.status)) continue;
      if (/HR HUB/i.test(res.text || "")) continue;
      return base;
    } catch {
      /* port bo‘sh */
    }
  }
  return "http://127.0.0.1:3000";
}

async function sectionFrontend(webBase) {
  const pages = [
    ["/", [200, 302, 307]],
    ["/login", [200]],
    ["/dashboard", [200, 302, 307]],
    ["/orders", [200, 302, 307]],
    ["/clients", [200, 302, 307]],
    ["/payments", [200, 302, 307]],
    ["/stock", [200, 302, 307]],
    ["/reports", [200, 302, 307]],
    ["/products", [200, 302, 307]],
    ["/access", [200, 302, 307]],
    ["/work-slots", [200, 302, 307]],
    ["/plans/daily", [200, 302, 307]]
  ];
  for (const [path, allow] of pages) {
    try {
      const res = await request(webBase, path, { redirect: "manual", timeoutMs: 15000 });
      const name = `web${path === "/" ? "-root" : path.replaceAll("/", "-")}`;
      if (allow.includes(res.status)) ok(name, res.status, res.location ? `→ ${res.location}` : "sahifa javob berdi");
      else fail(name, res.status, res.text.slice(0, 120) || "web javob yo‘q");
    } catch (e) {
      const name = `web${path === "/" ? "-root" : path.replaceAll("/", "-")}`;
      fail(name, 0, e instanceof Error ? e.message : String(e));
    }
  }
}

function printTable() {
  const pad = (s, n) => String(s).padEnd(n);
  console.log("");
  console.log(`${pad("BO‘LIM", 32)} ${pad("NATIJA", 8)} ${pad("HTTP", 6)} IZOH`);
  console.log("-".repeat(90));
  for (const r of rows) {
    console.log(
      `${pad(r.name, 32)} ${pad(r.status, 8)} ${pad(r.http ?? "", 6)} ${(r.reason || "").slice(0, 70)}`
    );
  }
  const counts = { OK: 0, FAIL: 0, SKIP: 0 };
  for (const r of rows) counts[r.status] += 1;
  console.log("-".repeat(90));
  console.log(`Jami: OK=${counts.OK}  FAIL=${counts.FAIL}  SKIP=${counts.SKIP}`);
  return counts;
}

async function main() {
  const webBase = await resolveWebBase();
  console.log(`API ${API_BASE}  WEB ${webBase}  slug=${SLUG}`);
  const healthy = await sectionHealth();
  if (!healthy) {
    skip("login-admin", "API /health ishlamayapti");
    skip("frontend", "avval API kerak emas — web alohida");
  }

  let admin = null;
  let agent = null;
  if (healthy) {
    const logins = await sectionLogin();
    admin = logins.admin;
    agent = logins.agent;
    if (admin?.token) {
      await sectionRefreshCookie(admin);
      await sectionAdminApis(admin.token);
      const rbacHint =
        process.env.RBAC_ENFORCE_PERMISSIONS === "1"
          ? "RBAC_ENFORCE=1"
          : "RBAC_ENFORCE lokalda 0 (prod majburiy 1)";
      await sectionRbac(agent, rbacHint);
      await sectionTenantIsolation(admin);
    }
    await sectionWebVitals();
    await sectionMobilePublic();
    await sectionMobileAgent(agent);
  } else {
    skip("api-sections", "backend ishlamayapti");
  }

  await sectionFrontend(webBase);
  const counts = printTable();
  if (counts.FAIL > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
