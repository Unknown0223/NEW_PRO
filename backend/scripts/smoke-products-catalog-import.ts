/**
 * Mahsulot katalogi importini to‘liq sinash:
 * 1) DB holati (oldin/keyin)
 * 2) To‘g‘ridan-to‘g‘ri import funksiyasi
 * 3) HTTP POST /products/import-catalog (frontend kabi)
 *
 * Ishga tushirish: npx tsx scripts/smoke-products-catalog-import.ts
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/config/database";
import { importProductsFromCatalogTemplateXlsx } from "../src/modules/products/products.import.catalog";

const API = process.env.API_BASE ?? "http://127.0.0.1:18080";
const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";
const LOGIN = process.env.IMPORT_LOGIN ?? "admin";
const PASSWORD = process.env.IMPORT_PASSWORD ?? "secret123";

const TEST_SKU_PREFIX = "SMOKE-IMP-";

async function login(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: TENANT, login: LOGIN, password: PASSWORD })
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

async function buildTestXlsx(categoryName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  // Frontend buildXlsxBlobFromPreview (products-catalog config) sarlavhalari
  ws.addRow([
    "Название *",
    "Код",
    "Категория *",
    "Единица измерения (название) *"
  ]);
  const ts = Date.now();
  ws.addRow([`Smoke import ${ts}`, `${TEST_SKU_PREFIX}${ts}`, categoryName, "dona"]);
  ws.addRow([`Smoke import 2 ${ts}`, `${TEST_SKU_PREFIX}${ts}-2`, categoryName, "dona"]);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

async function httpImport(token: string, xlsx: Buffer) {
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([xlsx], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }),
    "smoke-import.xlsx"
  );
  const res = await fetch(`${API}/api/${TENANT}/products/import-catalog`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, text, json };
}

async function main() {
  console.log("=== Smoke: products catalog import ===\n");

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
  if (!tenant) throw new Error(`Tenant ${TENANT} topilmadi`);

  const beforeCount = await prisma.product.count({ where: { tenant_id: tenant.id, is_active: true } });
  console.log(`Mahsulotlar (aktiv) oldin: ${beforeCount}`);

  const categories = await prisma.productCategory.findMany({
    where: { tenant_id: tenant.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 20
  });
  console.log(`Kategoriyalar: ${categories.map((c) => c.name).join(", ")}\n`);
  if (!categories.length) throw new Error("Kategoriya yo‘q — avval kategoriya qo‘shing");

  const categoryName = categories.find((c) => c.name.toUpperCase() === "POLKA")?.name ?? categories[0]!.name;
  console.log(`Test kategoriya: «${categoryName}»\n`);

  const xlsx = await buildTestXlsx(categoryName);
  const tmp = path.join(process.cwd(), "scripts", "output", `smoke-import-${Date.now()}.xlsx`);
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, xlsx);
  console.log(`Test fayl: ${tmp}\n`);

  console.log("--- 1) To‘g‘ridan-to‘g‘ri import funksiyasi ---");
  // Avvalgi importlar neaktiv bo‘lib qolgan bo‘lishi mumkin — re-import aktivlashtirishni tekshiradi
  await prisma.product.updateMany({
    where: { tenant_id: tenant.id, sku: { startsWith: TEST_SKU_PREFIX } },
    data: { is_active: false }
  });
  const direct = await importProductsFromCatalogTemplateXlsx(tenant.id, xlsx, 1);
  console.log(JSON.stringify(direct, null, 2));

  const afterDirect = await prisma.product.count({
    where: { tenant_id: tenant.id, sku: { startsWith: TEST_SKU_PREFIX }, is_active: true }
  });
  console.log(`Smoke SKU (aktiv): ${afterDirect}\n`);
  if (afterDirect === 0) {
    console.error("❌ Import dan keyin mahsulotlar aktiv emas — ro‘yxatda chiqmaydi");
    process.exit(1);
  }

  console.log("--- 2) HTTP POST /products/import-catalog ---");
  const token = await login();
  const httpXlsx = await buildTestXlsx(categoryName);
  const http = await httpImport(token, httpXlsx);
  console.log(`HTTP status: ${http.status}`);
  console.log(JSON.stringify(http.json, null, 2));

  const httpBody = (http.json ?? {}) as { created?: number; updated?: number; errors?: string[] };
  const httpSaved = (httpBody.created ?? 0) + (httpBody.updated ?? 0);
  const httpErrors = httpBody.errors ?? [];
  if (http.status !== 200 || httpSaved === 0 || httpErrors.length) {
    console.error("\n❌ HTTP import failed — API server eski kod bilan ishlayotgan bo‘lishi mumkin. Backend ni qayta ishga tushiring.");
    process.exit(1);
  }

  const afterCount = await prisma.product.count({ where: { tenant_id: tenant.id, is_active: true } });
  console.log(`\nMahsulotlar (aktiv) keyin: ${afterCount} (delta: +${afterCount - beforeCount})`);

  const listRes = await fetch(`${API}/api/${TENANT}/products?limit=5&search=${encodeURIComponent(TEST_SKU_PREFIX)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const list = (await listRes.json()) as { total: number; data: { sku: string; name: string; unit: string }[] };
  console.log(`\nAPI qidiruv «${TEST_SKU_PREFIX}»: total=${list.total}`);
  for (const p of list.data ?? []) {
    console.log(`  - ${p.sku} | ${p.name} | ${p.unit}`);
  }

  const ok = direct.created + direct.updated > 0 && afterDirect > 0 && httpSaved > 0;

  if (!ok) {
    console.error("\n❌ IMPORT SMOKE FAILED");
    process.exit(1);
  }
  console.log("\n✅ Import smoke muvaffaqiyatli");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
