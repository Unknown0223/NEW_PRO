import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

const minimalFilterBody = {
  datasetId: "orders_sales_lines",
  dateMode: "order_date",
  dateFrom: "2026-01-01",
  dateTo: "2026-01-31",
  agentIds: [] as number[],
  statuses: [] as string[],
  orderTypes: [] as string[]
};

const minimalPivotBody = {
  datasetId: "orders_sales_lines",
  dateMode: "order_date",
  dateFrom: "2026-01-01",
  dateTo: "2026-01-31",
  agentIds: [] as number[],
  statuses: [] as string[],
  orderTypes: [] as string[],
  rowFieldIds: ["product_name"],
  colFieldIds: [] as string[],
  metrics: { amount: true, qty: false, volume: false, akb: false }
};

describe.skipIf(!dbReady)("report-builder API (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("metadata → filter-options → dataset → preview → export → saved CRUD", async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const meta = await request(app.server).get("/api/test1/reports/report-builder/metadata").set(auth);
    expect(meta.status).toBe(200);
    expect(meta.body.data).toBeDefined();

    const filterOpts = await request(app.server)
      .get("/api/test1/reports/report-builder/filter-options")
      .set(auth);
    expect(filterOpts.status).toBe(200);
    expect(filterOpts.body.data).toBeDefined();

    const dataset = await request(app.server)
      .post("/api/test1/reports/report-builder/dataset")
      .set(auth)
      .send(minimalFilterBody);
    expect(dataset.status).toBe(200);
    expect(dataset.body.data).toBeDefined();
    expect(Array.isArray(dataset.body.data.rows)).toBe(true);
    expect(Array.isArray(dataset.body.data.fields)).toBe(true);

    const preview = await request(app.server)
      .post("/api/test1/reports/report-builder/preview")
      .set(auth)
      .send(minimalPivotBody);
    expect(preview.status).toBe(200);
    expect(preview.body.data).toBeDefined();
    expect(Array.isArray(preview.body.data.rows)).toBe(true);

    const exportRes = await request(app.server)
      .post("/api/test1/reports/report-builder/export")
      .set(auth)
      .send(minimalPivotBody);
    expect(exportRes.status).toBe(200);
    expect(String(exportRes.headers["content-type"])).toContain("spreadsheetml");
    expect(exportRes.headers["x-export-total"]).toBeDefined();
    const cl = exportRes.headers["content-length"];
    const xlsxBody = exportRes.body as Buffer | string | Record<string, unknown>;
    const byteLen = Buffer.isBuffer(xlsxBody)
      ? xlsxBody.length
      : typeof xlsxBody === "string"
        ? Buffer.byteLength(xlsxBody, "binary")
        : 0;
    if (cl != null && cl !== "") expect(Number(cl)).toBeGreaterThan(64);
    else expect(byteLen).toBeGreaterThan(64);

    const reportName = `it-rb-${Date.now()}`;
    const createSaved = await request(app.server)
      .post("/api/test1/reports/report-builder/saved")
      .set(auth)
      .send({
        name: reportName,
        config: {
          dataSource: { dataSourceType: "json", data: [] },
          slice: { measures: [{ uniqueName: "amount", aggregation: "sum" }] }
        }
      });
    expect(createSaved.status).toBe(200);
    const createdId = createSaved.body.data?.id as number;
    expect(Number.isFinite(createdId)).toBe(true);

    const listSaved = await request(app.server)
      .get("/api/test1/reports/report-builder/saved")
      .set(auth);
    expect(listSaved.status).toBe(200);
    expect(
      (listSaved.body.data as { id: number; name: string }[]).some((r) => r.id === createdId && r.name === reportName)
    ).toBe(true);

    const del = await request(app.server)
      .delete(`/api/test1/reports/report-builder/saved/${createdId}`)
      .set(auth);
    expect(del.status).toBe(204);
  });
});
