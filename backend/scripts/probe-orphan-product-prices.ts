/**
 * One-off: orphan product_prices must skip+warn (no Prisma 500).
 * Usage: npx tsx scripts/probe-orphan-product-prices.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const JSZip = require(path.join(root, "node_modules/jszip"));

const API = process.env.API_BASE || "http://127.0.0.1:18080";

async function login(slug: string): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, login: "admin", password: "secret123" })
  });
  const b = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`login ${res.status} ${JSON.stringify(b)}`);
  return String(b.accessToken || b.access_token || b.token || "");
}

async function main() {
  console.log("login…");
  const token = await login("migtest");
  const zipPath = path.join(root, "tmp", "roundtrip-test1.zip");
  if (!fs.existsSync(zipPath)) throw new Error(`missing ${zipPath} — run roundtrip first`);
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  zip.file(
    "data/product_prices.json",
    JSON.stringify([
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
    ])
  );
  const orphan = await zip.generateAsync({ type: "nodebuffer" });
  const fd = new FormData();
  fd.append("file", new Blob([orphan], { type: "application/zip" }), "backup.zip");
  fd.append("sync", "true");
  fd.append("force_nonempty", "true");
  fd.append("conflict_policy", "keep");
  fd.append("modules", JSON.stringify(["profile", "spravochniki", "initial_setup"]));
  console.log("apply…");
  const res = await fetch(`${API}/api/migtest/system-migration/import/apply`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const warnings = (body.warnings as string[]) || [];
  console.log(
    JSON.stringify(
      {
        status: res.status,
        error: body.error,
        message: String(body.message || "").slice(0, 280),
        warnings: warnings.slice(0, 8),
        hasUzWarn: warnings.some((w) => /Mahsulot narxi|mahsulot topilmadi/i.test(w))
      },
      null,
      2
    )
  );
  const ok =
    res.status === 200 &&
    !/Argument.*product|Invalid `.*create/i.test(String(body.message || "")) &&
    warnings.some((w) => /Mahsulot narxi|mahsulot topilmadi/i.test(w));
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
