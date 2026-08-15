import ExcelJS from "exceljs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { contractSmokeDbReady } from "./contract-smoke.harness";
import { importProductsFromCatalogTemplateXlsx } from "../src/modules/products/products.import.catalog";
import { prisma } from "../src/config/database";

const dbReady = contractSmokeDbReady;

async function adminToken(app: ReturnType<typeof buildApp>) {
  const login = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(login.status).toBe(200);
  return login.body.accessToken as string;
}

async function buildSampleXlsx(categoryName: string, sku: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  ws.addRow([
    "Название *",
    "Код",
    "Категория *",
    "Единица измерения (название) *"
  ]);
  ws.addRow([`Vitest import ${sku}`, sku, categoryName, "dona"]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe.skipIf(!dbReady)("products catalog import", () => {
  const app = buildApp();
  let tenantId = 0;
  let categoryName = "";

  beforeAll(async () => {
    await app.ready();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });
    tenantId = tenant.id;
    const cat = await prisma.productCategory.findFirst({
      where: { tenant_id: tenantId },
      orderBy: { name: "asc" }
    });
    categoryName = cat?.name ?? "POLKA";
  });

  afterAll(async () => {
    await app.close();
  });

  it("imports rows when unit column header contains «название»", async () => {
    const sku = `VITEST-IMP-${Date.now()}`;
    const xlsx = await buildSampleXlsx(categoryName, sku);
    const result = await importProductsFromCatalogTemplateXlsx(tenantId, xlsx, 1);
    expect(result.errors).toEqual([]);
    expect(result.created + result.updated).toBeGreaterThan(0);

    const row = await prisma.product.findFirst({
      where: { tenant_id: tenantId, sku }
    });
    expect(row?.name).toContain("Vitest import");
    expect(row?.unit).toBe("dona");
  });

  it("POST /products/import-catalog accepts template headers", async () => {
    const token = await adminToken(app);
    const sku = `VITEST-HTTP-${Date.now()}`;
    const xlsx = await buildSampleXlsx(categoryName, sku);

    const res = await request(app.server)
      .post("/api/test1/products/import-catalog")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", xlsx, "catalog-import.xlsx");

    expect(res.status).toBe(200);
    expect(res.body.created + res.body.updated).toBeGreaterThan(0);
    expect(res.body.errors ?? []).toEqual([]);
  });
});
