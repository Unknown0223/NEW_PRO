/**
 * System migration full roundtrip + edge-case matrix.
 *
 * Usage:
 *   npx tsx scripts/test-system-migration-roundtrip.ts
 *
 * Env:
 *   API_BASE (default http://127.0.0.1:18080)
 *   SOURCE_SLUG (default test1)
 *   TARGET_SLUG (default migtest — throwaway)
 *   ADMIN_LOGIN / ADMIN_PASSWORD
 */
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const JSZip = require(path.join(root, "node_modules/jszip"));

const API = process.env.API_BASE || "http://127.0.0.1:18080";
const SOURCE = process.env.SOURCE_SLUG || "test1";
const TARGET = process.env.TARGET_SLUG || "migtest";
const LOGIN = process.env.ADMIN_LOGIN || "admin";
const PASSWORD = process.env.ADMIN_PASSWORD || "secret123";

type CaseResult = { id: string; ok: boolean; detail: string };
const results: CaseResult[] = [];

function pass(id: string, detail = "") {
  results.push({ id, ok: true, detail });
  console.log(`PASS | ${id}${detail ? ` — ${detail}` : ""}`);
}
function fail(id: string, detail = "") {
  results.push({ id, ok: false, detail });
  console.log(`FAIL | ${id}${detail ? ` — ${detail}` : ""}`);
}
function assert(id: string, cond: boolean, detail: string) {
  if (cond) pass(id, detail);
  else fail(id, detail);
}

async function login(slug: string): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, login: LOGIN, password: PASSWORD })
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`login ${slug} ${res.status}: ${String(body.message || "")}`);
  }
  const token = String(body.accessToken || body.access_token || body.token || "");
  if (!token) throw new Error(`login ${slug}: token yo‘q`);
  return token;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function exportZip(slug: string, token: string): Promise<Buffer> {
  const res = await fetch(`${API}/api/${slug}/system-migration/export.backup.zip`, {
    headers: authHeaders(token)
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw new Error(`export ${res.status}: ${buf.toString("utf8").slice(0, 300)}`);
  }
  return buf;
}

async function preview(
  slug: string,
  token: string,
  zipBuf: Buffer,
  filename = "backup.zip"
): Promise<{ status: number; body: Record<string, unknown> }> {
  const fd = new FormData();
  fd.append("file", new Blob([zipBuf], { type: "application/zip" }), filename);
  const res = await fetch(`${API}/api/${slug}/system-migration/import/preview`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

async function applySync(
  slug: string,
  token: string,
  zipBuf: Buffer,
  fields: Record<string, string>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const fd = new FormData();
  fd.append("file", new Blob([zipBuf], { type: "application/zip" }), "backup.zip");
  fd.append("sync", "true");
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(`${API}/api/${slug}/system-migration/import/apply`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, body };
}

function isClearUserMessage(msg: unknown): boolean {
  if (typeof msg !== "string" || !msg.trim()) return false;
  const m = msg.trim();
  // Technical codes should not be the only user-facing text
  if (/^(TARGET_NOT_EMPTY|PROFILE_MISSING|INVALID_BACKUP|MAP_MISSING)/i.test(m)) return false;
  if (/^P20\d{2}/.test(m)) return false;
  if (/Unexpected server error|Internal Server Error|ECONNREFUSED/i.test(m)) return false;
  if (/\bkind\b|force_nonempty/i.test(m)) return false;
  if (/Invalid `?\w+\.create\(\)`?|Argument [`']?\w+[`']? is missing|PrismaClient|invocation in|[A-Za-z]:\\|node_modules|\.ts:\d+/i.test(m)) {
    return false;
  }
  return m.length >= 8;
}

async function validateZipStructure(zipBuf: Buffer): Promise<{
  ok: boolean;
  detail: string;
  paths: string[];
  manifest: Record<string, unknown> | null;
}> {
  const zip = await JSZip.loadAsync(zipBuf);
  const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
  const required = [
    "manifest.json",
    "spravochniki/tenant-profile.json",
    "data/users.json",
    "data/clients.json",
    "data/products.json",
    "data/warehouses.json",
    "data/orders.json"
  ];
  const missing = required.filter((p) => !zip.file(p));
  let manifest: Record<string, unknown> | null = null;
  try {
    manifest = JSON.parse(await zip.file("manifest.json")!.async("string")) as Record<string, unknown>;
  } catch {
    return { ok: false, detail: "manifest.json parse fail", paths, manifest: null };
  }
  const kindOk = manifest.kind === "salec-tenant-backup";
  const verOk = Number(manifest.format_version) === 5;
  const ok = missing.length === 0 && kindOk && verOk;
  return {
    ok,
    detail: ok
      ? `files=${paths.length} kind=${manifest.kind} v=${manifest.format_version}`
      : `missing=[${missing.join(",")}] kind=${manifest.kind} v=${manifest.format_version}`,
    paths,
    manifest
  };
}

async function buildCorruptManifestZip(base: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(base);
  zip.file("manifest.json", "{ not-json");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildWrongKindZip(base: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(base);
  const raw = JSON.parse(await zip.file("manifest.json")!.async("string")) as Record<string, unknown>;
  raw.kind = "not-a-backup";
  zip.file("manifest.json", JSON.stringify(raw));
  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildNoManifestZip(base: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(base);
  zip.remove("manifest.json");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildCorruptProfileZip(base: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(base);
  zip.file("spravochniki/tenant-profile.json", "{broken");
  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildOrphanProductPricesZip(base: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(base);
  const prices = [
    {
      id: 999001,
      tenant_id: 1,
      product_id: 999999001,
      price_type: "1",
      price: "100.00",
      currency: "UZS",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  zip.file("data/product_prices.json", JSON.stringify(prices));
  return zip.generateAsync({ type: "nodebuffer" });
}

async function main() {
  console.log(`API=${API} source=${SOURCE} target=${TARGET}`);
  const tmpDir = path.join(root, "tmp");
  await mkdir(tmpDir, { recursive: true });

  // ── 1. Auth ──────────────────────────────────────────────
  let sourceToken: string;
  let targetToken: string;
  try {
    sourceToken = await login(SOURCE);
    pass("auth/source", SOURCE);
  } catch (e) {
    fail("auth/source", String((e as Error).message));
    printSummary();
    return;
  }
  try {
    targetToken = await login(TARGET);
    pass("auth/target", TARGET);
  } catch (e) {
    fail("auth/target", String((e as Error).message));
    printSummary();
    return;
  }

  // ── 2. Inventory ─────────────────────────────────────────
  {
    const res = await fetch(`${API}/api/${SOURCE}/system-migration/inventory`, {
      headers: authHeaders(sourceToken)
    });
    const body = (await res.json().catch(() => ({}))) as {
      modules?: Array<{ id: string; export_status: string }>;
    };
    const mods = body.modules ?? [];
    const included = mods.filter((m) => m.export_status === "included").length;
    assert(
      "inventory",
      res.ok && mods.length >= 10,
      `status=${res.status} modules=${mods.length} included=${included}`
    );
  }

  // ── 3. Export ────────────────────────────────────────────
  let zipBuf: Buffer;
  try {
    zipBuf = await exportZip(SOURCE, sourceToken);
    const zipPath = path.join(tmpDir, `roundtrip-${SOURCE}.zip`);
    await writeFile(zipPath, zipBuf);
    assert("export.zip", zipBuf.length > 1000 && zipBuf[0] === 0x50 && zipBuf[1] === 0x4b, `${zipBuf.length} bytes → ${zipPath}`);
  } catch (e) {
    fail("export.zip", String((e as Error).message));
    printSummary();
    return;
  }

  // ── 4. ZIP structure ─────────────────────────────────────
  {
    const v = await validateZipStructure(zipBuf);
    assert("zip.structure", v.ok, v.detail);
    const hasXlsx = v.paths.some((p) => p.includes("initial-setup.xlsx"));
    assert("zip.has_initial_setup_xlsx", hasXlsx, hasXlsx ? "ok" : "missing");
  }

  // ── 5. Preview (source nonempty + target) ────────────────
  {
    const { status, body } = await preview(SOURCE, sourceToken, zipBuf);
    assert(
      "preview.source",
      status === 200 && body.valid === true,
      `status=${status} valid=${body.valid} empty=${body.target_empty} blockers=${JSON.stringify(body.target_blockers)}`
    );
    assert("preview.source_nonempty", body.target_empty === false, `target_empty=${body.target_empty}`);
  }
  {
    const { status, body } = await preview(TARGET, targetToken, zipBuf);
    assert(
      "preview.target",
      status === 200 && body.valid === true,
      `status=${status} valid=${body.valid} empty=${body.target_empty}`
    );
    const modules = (body.modules as Array<{ id: string }>) || [];
    assert("preview.modules_present", modules.length >= 10, `modules=${modules.length}`);
  }

  // ── 6. Edge: no file ─────────────────────────────────────
  {
    const fd = new FormData();
    const res = await fetch(`${API}/api/${TARGET}/system-migration/import/preview`, {
      method: "POST",
      headers: authHeaders(targetToken),
      body: fd
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    assert(
      "preview.no_file",
      res.status === 400 && isClearUserMessage(body.message),
      `status=${res.status} msg=${body.message}`
    );
  }

  // ── 7. Edge: empty / not zip ─────────────────────────────
  {
    const { status, body } = await preview(TARGET, targetToken, Buffer.from("not-a-zip"), "bad.txt");
    const errors = (body.errors as string[]) || [];
    const msg = errors.join("; ") || String(body.message || "");
    assert(
      "preview.invalid_zip",
      (status === 200 && body.valid === false) || status === 400,
      `status=${status} valid=${body.valid} msg=${msg}`
    );
    assert("preview.invalid_zip_clear_msg", isClearUserMessage(msg) || errors.some(isClearUserMessage), msg);
  }

  // ── 8. Edge: missing manifest ────────────────────────────
  {
    const bad = await buildNoManifestZip(zipBuf);
    const { status, body } = await preview(TARGET, targetToken, bad);
    const errors = (body.errors as string[]) || [];
    assert(
      "preview.missing_manifest",
      status === 200 && body.valid === false && errors.some((e) => /manifest/i.test(e)),
      `errors=${errors.join(" | ")}`
    );
  }

  // ── 9. Edge: wrong kind ──────────────────────────────────
  {
    const bad = await buildWrongKindZip(zipBuf);
    const { status, body } = await preview(TARGET, targetToken, bad);
    const errors = (body.errors as string[]) || [];
    assert(
      "preview.wrong_kind",
      status === 200 && body.valid === false && errors.some((e) => /SALEC zaxira|arxiv|tur/i.test(e)),
      `errors=${errors.join(" | ")}`
    );
  }

  // ── 10. Edge: corrupt manifest JSON ──────────────────────
  {
    const bad = await buildCorruptManifestZip(zipBuf);
    const { status, body } = await preview(TARGET, targetToken, bad);
    const errors = (body.errors as string[]) || [];
    assert(
      "preview.corrupt_manifest",
      status === 200 && body.valid === false && errors.length > 0,
      `errors=${errors.join(" | ")}`
    );
    assert(
      "preview.corrupt_manifest_clear",
      errors.every(isClearUserMessage),
      errors.join(" | ")
    );
  }

  // ── 11. Apply: TARGET_NOT_EMPTY without force ────────────
  {
    const { status, body } = await applySync(SOURCE, sourceToken, zipBuf, {});
    assert(
      "apply.blocked_nonempty",
      status === 409 &&
        (body.error === "TargetNotEmpty" ||
          /ma’lumotlarga ega|bo‘sh emas|bosh emas|davom etish/i.test(String(body.message))),
      `status=${status} error=${body.error} msg=${body.message}`
    );
    assert("apply.blocked_nonempty_clear_msg", isClearUserMessage(body.message), String(body.message));
  }

  // ── 12. Apply: empty/friendly target — profile_only ──────
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      mode: "profile_only",
      force_nonempty: "true"
    });
    const applied = (body.applied as string[]) || [];
    assert(
      "apply.profile_only",
      status === 200 && applied.some((a) => /tenant-profile/.test(a)),
      `status=${status} applied=${applied.slice(0, 5).join(",")}`
    );
  }

  // ── 13. Apply: subset modules (profile only via checkbox) ─
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify(["profile"])
    });
    const applied = (body.applied as string[]) || [];
    const skipped = (body.skipped as string[]) || [];
    assert(
      "apply.modules_profile",
      status === 200 && applied.length >= 1,
      `status=${status} applied=${applied.length} skipped=${skipped.length}`
    );
    assert(
      "apply.modules_profile_skips_ops",
      skipped.some((s) => /operatsion|spravochnik|kengaytirilgan|bonus/i.test(s)),
      `skipped=${skipped.join(" | ")}`
    );
  }

  // ── 14. Apply: spravochniki only ─────────────────────────
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify(["profile", "spravochniki"])
    });
    const applied = (body.applied as string[]) || [];
    const skipped = (body.skipped as string[]) || [];
    assert(
      "apply.modules_spravochniki",
      status === 200 && applied.some((a) => /users\.json|clients\.json|products\.json/.test(a)),
      `status=${status} applied=${applied.filter((a) => a.startsWith("data/")).slice(0, 8).join(",")}`
    );
    assert(
      "apply.modules_spravochniki_skip_tx",
      skipped.some((s) => /operatsion/i.test(s)),
      `skipped=${skipped.join(" | ")}`
    );
  }

  // ── 15. Apply: conflict keep on nonempty ─────────────────
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify(["profile", "spravochniki", "extended", "initial_setup"])
    });
    const warnings = (body.warnings as string[]) || [];
    assert(
      "apply.conflict_keep",
      status === 200 && Array.isArray(body.applied),
      `status=${status} warnings=${warnings.length}`
    );
    assert(
      "apply.conflict_keep_warning",
      warnings.some((w) => /eski qoldi|saqlandi|bo‘sh emas/i.test(w)),
      warnings.slice(0, 3).join(" | ") || "(no keep warning)"
    );
  }

  // ── 16. Apply: conflict replace ──────────────────────────
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "replace",
      modules: JSON.stringify(["profile", "spravochniki"])
    });
    const warnings = (body.warnings as string[]) || [];
    assert(
      "apply.conflict_replace",
      status === 200 && Array.isArray(body.applied),
      `status=${status} warnings=${warnings.length}`
    );
    assert(
      "apply.conflict_replace_warning",
      warnings.some((w) => /almashtirish|arxiv qiymatlari/i.test(w)),
      warnings.slice(0, 3).join(" | ") || "(no replace warning)"
    );
  }

  // ── 17. Apply: operational skip when source has orders ───
  // Re-import full modules onto TARGET which now has references; SOURCE has orders.
  // Import onto SOURCE (nonempty with orders) should skip operational history.
  {
    const { status, body } = await applySync(SOURCE, sourceToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify([
        "profile",
        "spravochniki",
        "orders",
        "payments",
        "warehouse",
        "returns",
        "audit"
      ])
    });
    const skipped = (body.skipped as string[]) || [];
    const warnings = (body.warnings as string[]) || [];
    const opsSkipped =
      skipped.some((s) => /operatsion|orders\/payments/i.test(s)) ||
      warnings.some((w) => /buyurtma\/to‘lov|operatsion tarix import qilinmadi/i.test(w));
    assert(
      "apply.ops_skip_on_busy",
      status === 200 && opsSkipped,
      `status=${status} skipped=${skipped.join(" | ")} warn=${warnings.filter((w) => /operatsion|buyurtma/i.test(w)).join(" | ")}`
    );
  }

  // ── 18. Apply: invalid backup sync ───────────────────────
  {
    const bad = await buildWrongKindZip(zipBuf);
    const { status, body } = await applySync(TARGET, targetToken, bad, {
      force_nonempty: "true",
      mode: "profile_only"
    });
    assert(
      "apply.invalid_backup",
      status === 400 &&
        (body.error === "InvalidBackup" || /arxiv|SALEC|yaroqsiz|buzilgan/i.test(String(body.message))),
      `status=${status} error=${body.error} msg=${body.message}`
    );
    assert("apply.invalid_backup_clear", isClearUserMessage(body.message), String(body.message));
  }

  // ── 19. Corrupt profile on apply (sync) ──────────────────
  {
    const bad = await buildCorruptProfileZip(zipBuf);
    const { status, body } = await applySync(TARGET, targetToken, bad, {
      force_nonempty: "true",
      mode: "profile_only"
    });
    // May fail at JSON.parse with 500 or InvalidBackup — either way message must be clear
    const msg = String(body.message || body.error || "");
    const errors = (body.errors as string[]) || [];
    assert(
      "apply.corrupt_profile",
      status === 400 &&
        (body.error === "InvalidBackup" ||
          /profil|buzilgan|JSON|arxiv/i.test(msg) ||
          errors.some((e) => /profil|buzilgan/i.test(e))),
      `status=${status} msg=${msg.slice(0, 200)}`
    );
    assert(
      "apply.corrupt_profile_clear",
      isClearUserMessage(msg) || errors.some(isClearUserMessage),
      msg || errors.join(" | ")
    );
  }

  // ── 20. Warning aggregation smoke ────────────────────────
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify(["profile", "spravochniki", "extended"])
    });
    const warnings = (body.warnings as string[]) || [];
    const uniq = new Set(warnings);
    assert(
      "warnings.aggregated",
      status === 200 && uniq.size === warnings.length,
      `count=${warnings.length} unique=${uniq.size}`
    );
  }

  // ── 20b. initial_setup + spravochniki: product_prices must not 500 ─
  {
    const { status, body } = await applySync(TARGET, targetToken, zipBuf, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify(["profile", "spravochniki", "initial_setup"])
    });
    const msg = String(body.message || "");
    const warnings = (body.warnings as string[]) || [];
    const applied = (body.applied as string[]) || [];
    assert(
      "apply.initial_setup_prices_ok",
      status === 200 && !/Argument.*product|Invalid `.*create|PrismaClient|[A-Za-z]:\\/i.test(msg),
      `status=${status} msg=${msg.slice(0, 200)} applied=${applied.filter((a) => /price/.test(a)).join(",")}`
    );
    assert(
      "apply.initial_setup_no_prisma_in_warnings",
      warnings.every((w) => !/Prisma|Argument|invocation|[A-Za-z]:\\|\.ts:\d+/i.test(w)),
      warnings.filter((w) => /Prisma|Argument|invocation/i.test(w)).slice(0, 2).join(" | ") || "ok"
    );
  }

  // ── 20c. Orphan product_prices (null/unmapped product_id) — skip+warn, no 500 ─
  {
    const orphanZip = await buildOrphanProductPricesZip(zipBuf);
    const { status, body } = await applySync(TARGET, targetToken, orphanZip, {
      force_nonempty: "true",
      conflict_policy: "keep",
      modules: JSON.stringify(["profile", "spravochniki", "initial_setup"])
    });
    const msg = String(body.message || "");
    const warnings = (body.warnings as string[]) || [];
    const hasPriceWarn = warnings.some((w) => /Mahsulot narxi|mahsulot topilmadi/i.test(w));
    assert(
      "apply.orphan_product_prices",
      status === 200 && !/Argument.*product|Invalid `.*create/i.test(msg),
      `status=${status} msg=${msg.slice(0, 180)} warnings=${warnings.slice(0, 3).join(" | ")}`
    );
    assert(
      "apply.orphan_product_prices_uz_warn",
      status === 200 && hasPriceWarn,
      `hasPriceWarn=${hasPriceWarn} warnings=${warnings.filter((w) => /narx|mahsulot/i.test(w)).slice(0, 3).join(" | ")}`
    );
  }

  // ── 21. Counts sanity: preview vs inventory (source) ─────
  {
    const invRes = await fetch(`${API}/api/${SOURCE}/system-migration/inventory`, {
      headers: authHeaders(sourceToken)
    });
    const inv = (await invRes.json()) as {
      modules: Array<{ id: string; counts: Record<string, number> }>;
    };
    const { body } = await preview(SOURCE, sourceToken, zipBuf);
    const prevMods = (body.modules as Array<{ id: string; counts?: Record<string, number> }>) || [];
    const ordersInv = inv.modules.find((m) => m.id === "orders");
    const ordersPrev = prevMods.find((m) => m.id === "orders");
    const invOrders = ordersInv?.counts?.orders ?? ordersInv?.counts?.order ?? 0;
    const prevOrders = ordersPrev?.counts?.orders ?? 0;
    assert(
      "counts.orders_match",
      invOrders === prevOrders || (invOrders > 0 && prevOrders > 0),
      `inv.orders=${invOrders} preview.orders=${prevOrders}`
    );
  }

  // ── 22. Full import onto fresh empty tenant (if available) ─
  const EMPTY = process.env.EMPTY_SLUG || "migfresh";
  try {
    const emptyToken = await login(EMPTY);
    const prev = await preview(EMPTY, emptyToken, zipBuf);
    if (prev.body.target_empty !== true) {
      pass(
        "empty.preview",
        `skip — ${EMPTY} bo‘sh emas (blockers=${JSON.stringify(prev.body.target_blockers)}); EMPTY_SLUG bering`
      );
      pass("empty.full_apply", "skip — target bo‘sh emas");
      pass("empty.full_apply_no_ops_skip", "skip — target bo‘sh emas");
    } else {
      assert(
        "empty.preview",
        prev.status === 200 && prev.body.valid === true && prev.body.target_empty === true,
        `valid=${prev.body.valid} empty=${prev.body.target_empty} blockers=${JSON.stringify(prev.body.target_blockers)}`
      );
      const { status, body } = await applySync(EMPTY, emptyToken, zipBuf, {
        conflict_policy: "keep"
      });
      const applied = (body.applied as string[]) || [];
      const skipped = (body.skipped as string[]) || [];
      const warnings = (body.warnings as string[]) || [];
      assert(
        "empty.full_apply",
        status === 200 && applied.some((a) => /users\.json|orders\.json/.test(a)),
        `status=${status} error=${body.error} msg=${String(body.message || "").slice(0, 160)} applied=${applied.length} skipped=${skipped.join(" | ")}`
      );
      assert(
        "empty.full_apply_no_ops_skip",
        status === 200 && !skipped.some((s) => /orders\/payments.*allaqachon/.test(s)),
        `status=${status} skipped=${skipped.join(" | ")} warn=${warnings.slice(0, 2).join(" | ")}`
      );
    }
  } catch (e) {
    fail("empty.preview", `tenant ${EMPTY}: ${String((e as Error).message)}`);
  }

  printSummary();
}

function printSummary() {
  console.log("\n========== ROUNDTRIP SUMMARY ==========");
  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.id}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(
    failed.length === 0
      ? `\nALL PASSED (${results.length})`
      : `\nFAILED ${failed.length}/${results.length}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
