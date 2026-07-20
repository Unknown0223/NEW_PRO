/**
 * System migration import smoke test (local API).
 *
 * Usage:
 *   node scripts/test-system-migration-import.mjs
 *   node scripts/test-system-migration-import.mjs --zip path/to.backup.zip
 *   node scripts/test-system-migration-import.mjs --login admin --password secret123
 *
 * Env: API_BASE, TENANT_SLUG, ADMIN_LOGIN, ADMIN_PASSWORD
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const JSZip = require(path.join(root, "backend/node_modules/jszip"));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const API = process.env.API_BASE || "http://127.0.0.1:18080";
const SLUG = process.env.TENANT_SLUG || arg("--slug", "test1");
const LOGIN = process.env.ADMIN_LOGIN || arg("--login", "admin");
const PASSWORD = process.env.ADMIN_PASSWORD || arg("--password", "secret123");
const ZIP_ARG = arg("--zip", "");

const results = [];

function log(step, ok, detail = "") {
  const line = `${ok ? "PASS" : "FAIL"} | ${step}${detail ? ` — ${detail}` : ""}`;
  results.push({ step, ok, detail });
  console.log(line);
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: SLUG, login: LOGIN, password: PASSWORD })
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`login non-json ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`login ${res.status}: ${body.message || text.slice(0, 200)}`);
  const token = body.accessToken || body.access_token || body.token;
  if (!token) throw new Error("login: access token yo‘q");
  return token;
}

async function buildMinimalZip() {
  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify({
      format_version: 5,
      kind: "salec-tenant-backup",
      exported_at: new Date().toISOString(),
      source: { tenant_id: 1, tenant_slug: SLUG, tenant_name: "Test" },
      modules: []
    })
  );
  zip.file(
    "spravochniki/tenant-profile.json",
    JSON.stringify({
      name: "Test Tenant Import Smoke",
      phone: null,
      address: null,
      logo_url: null,
      feature_flags: {},
      return_filter: {},
      references: {}
    })
  );
  // Minimal reference files so full mode enters references pipeline
  zip.file("data/warehouses.json", "[]");
  zip.file("data/trade_directions.json", "[]");
  zip.file("data/sales_channel_refs.json", "[]");
  zip.file("data/users.json", "[]");
  zip.file("data/clients.json", "[]");
  zip.file("data/products.json", "[]");
  zip.file("data/cash_desks.json", "[]");
  zip.file("data/stock.json", "[]");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  console.log(`API=${API} slug=${SLUG}`);
  let token;
  try {
    token = await login();
    log("auth/login", true);
  } catch (e) {
    log("auth/login", false, String(e.message || e));
    printSummary(1);
    return;
  }

  const auth = { Authorization: `Bearer ${token}` };

  // Inventory
  {
    const res = await fetch(`${API}/api/${SLUG}/system-migration/inventory`, { headers: auth });
    log("GET inventory", res.ok, `status=${res.status}`);
  }

  // Preview
  let zipBuf;
  if (ZIP_ARG) {
    zipBuf = await readFile(path.resolve(ZIP_ARG));
  } else {
    zipBuf = await buildMinimalZip();
    const outDir = path.join(root, "tmp");
    await mkdir(outDir, { recursive: true });
    const out = path.join(outDir, "smoke-migration-backup.zip");
    await writeFile(out, zipBuf);
    console.log(`Wrote ${out}`);
  }

  {
    const fd = new FormData();
    fd.append("file", new Blob([zipBuf], { type: "application/zip" }), "smoke.salec-backup.zip");
    const res = await fetch(`${API}/api/${SLUG}/system-migration/import/preview`, {
      method: "POST",
      headers: auth,
      body: fd
    });
    const body = await res.json().catch(() => ({}));
    log(
      "POST import/preview",
      res.ok && body.valid === true,
      `status=${res.status} valid=${body.valid} empty=${body.target_empty}`
    );
  }

  // Apply profile_only async (progress)
  {
    const fd = new FormData();
    fd.append("file", new Blob([zipBuf], { type: "application/zip" }), "smoke.salec-backup.zip");
    fd.append("mode", "profile_only");
    fd.append("force_nonempty", "true");
    const res = await fetch(`${API}/api/${SLUG}/system-migration/import/apply`, {
      method: "POST",
      headers: auth,
      body: fd
    });
    const body = await res.json().catch(() => ({}));
    const accepted = res.status === 202 && body.async === true && (body.jobId || body.sessionId);
    log(
      "POST import/apply (202 async)",
      accepted,
      `status=${res.status} keys=${Object.keys(body).join(",")}`
    );

    if (body.sessionId) {
      let done = false;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const sRes = await fetch(
          `${API}/api/${SLUG}/system-migration/import/sessions/${body.sessionId}`,
          { headers: auth }
        );
        const s = await sRes.json().catch(() => ({}));
        if (i === 0 || s.state !== "active") {
          console.log(
            `  session progress: state=${s.state} stage=${s.progress?.stage} ${s.progress?.percent}% — ${s.progress?.message}`
          );
        }
        if (s.state === "completed") {
          log("session completed", true, `applied=${(s.result?.applied || []).length}`);
          done = true;
          break;
        }
        if (s.state === "failed") {
          log("session completed", false, s.error || "failed");
          done = true;
          break;
        }
      }
      if (!done) log("session completed", false, "timeout");
    } else if (body.jobId) {
      let done = false;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const jRes = await fetch(`${API}/api/${SLUG}/jobs/${body.jobId}`, { headers: auth });
        const j = await jRes.json().catch(() => ({}));
        if (i === 0 || j.state === "completed" || j.state === "failed") {
          console.log(
            `  job progress: state=${j.state} ${j.progress?.percent ?? 0}% — ${j.progress?.message || ""}`
          );
        }
        if (j.state === "completed") {
          log("job completed", true);
          done = true;
          break;
        }
        if (j.state === "failed") {
          log("job completed", false, j.failedReason || "failed");
          done = true;
          break;
        }
      }
      if (!done) log("job completed", false, "timeout");
    } else if (res.ok && Array.isArray(body.applied)) {
      log("sync apply result", true, `applied=${body.applied.length}`);
    }
  }

  // Sync profile_only (explicit)
  {
    const fd = new FormData();
    fd.append("file", new Blob([zipBuf], { type: "application/zip" }), "smoke.salec-backup.zip");
    fd.append("mode", "profile_only");
    fd.append("force_nonempty", "true");
    fd.append("sync", "true");
    const res = await fetch(`${API}/api/${SLUG}/system-migration/import/apply`, {
      method: "POST",
      headers: auth,
      body: fd
    });
    const body = await res.json().catch(() => ({}));
    log(
      "POST import/apply sync profile_only",
      res.ok && Array.isArray(body.applied),
      `status=${res.status}`
    );
  }

  const failed = results.filter((r) => !r.ok).length;
  printSummary(failed ? 1 : 0);
}

function printSummary(code) {
  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.step}${r.detail ? ` (${r.detail})` : ""}`);
  }
  console.log(code === 0 ? "\nALL PASSED" : `\nFAILED: ${results.filter((r) => !r.ok).length}`);
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
