import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();
const TEST_PREFIX = "test-geo-";

const POLY_A = [
  { lat: 41.3, lng: 69.2 },
  { lat: 41.35, lng: 69.2 },
  { lat: 41.35, lng: 69.28 },
  { lat: 41.3, lng: 69.28 }
];

const POLY_B = [
  { lat: 41.32, lng: 69.22 },
  { lat: 41.37, lng: 69.22 },
  { lat: 41.37, lng: 69.3 },
  { lat: 41.32, lng: 69.3 }
];

async function loginToken(): Promise<string> {
  const loginResponse = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(loginResponse.status).toBe(200);
  return loginResponse.body.accessToken as string;
}

async function cleanupTestBoundaries(token: string): Promise<void> {
  const list = await request(app.server)
    .get("/api/test1/geo-boundaries")
    .set("Authorization", `Bearer ${token}`);
  if (list.status !== 200) return;
  for (const b of list.body.data as { id: string; ref_id: string }[]) {
    if (b.ref_id.startsWith(TEST_PREFIX)) {
      await request(app.server)
        .delete(`/api/test1/geo-boundaries/${b.id}`)
        .set("Authorization", `Bearer ${token}`);
    }
  }
}

describe.skipIf(!dbReady)("geo-boundaries API (branch / zone / territory)", () => {
  let token = "";

  beforeAll(async () => {
    await app.ready();
    token = await loginToken();
    await cleanupTestBoundaries(token);
  });

  afterAll(async () => {
    if (token) await cleanupTestBoundaries(token);
    await app.close();
  });

  it("saves branch boundary without overlap", async () => {
    const res = await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "branch",
        ref_id: `${TEST_PREFIX}branch-1`,
        name: "Test Filial",
        polygon: POLY_A,
        clip_against_existing: false,
        color: "#2563eb"
      });
    expect(res.status).toBe(200);
    expect(res.body.boundary.kind).toBe("branch");
    expect(res.body.boundary.polygon.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 409 when zone overlaps branch (cross-kind)", async () => {
    const res = await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "zone",
        ref_id: `${TEST_PREFIX}zone-1`,
        name: "Test Zona",
        polygon: POLY_B,
        clip_against_existing: false,
        color: "#0891b2"
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("GeoBoundaryOverlap");
    expect(Array.isArray(res.body.conflicts)).toBe(true);
    expect(res.body.conflicts.some((c: { kind: string }) => c.kind === "branch")).toBe(true);
  });

  it("saves zone with existing_wins (A) after clipping", async () => {
    const res = await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "zone",
        ref_id: `${TEST_PREFIX}zone-1`,
        name: "Test Zona",
        polygon: POLY_B,
        clip_against_existing: false,
        overlap_resolution: "existing_wins",
        color: "#0891b2"
      });
    expect(res.status).toBe(200);
    expect(res.body.boundary.kind).toBe("zone");
    expect(res.body.clipped).toBe(true);
    expect(res.body.boundary.polygon.length).toBeGreaterThanOrEqual(3);
  });

  it("returns 409 when territory overlaps zone", async () => {
    const res = await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "territory",
        ref_id: `${TEST_PREFIX}territory-1`,
        name: "Test Territoriya",
        polygon: POLY_B,
        clip_against_existing: false,
        color: "#16a34a"
      });
    expect(res.status).toBe(409);
    expect(res.body.conflicts.some((c: { kind: string }) => c.kind === "zone")).toBe(true);
  });

  it("saves territory with incoming_wins (B) — zone trimmed or removed if inside", async () => {
    const res = await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "territory",
        ref_id: `${TEST_PREFIX}territory-1`,
        name: "Test Territoriya",
        polygon: POLY_B,
        clip_against_existing: false,
        overlap_resolution: "incoming_wins",
        color: "#16a34a"
      });
    expect(res.status).toBe(200);
    expect(res.body.boundary.kind).toBe("territory");
    expect(res.body.boundary.polygon.length).toBeGreaterThanOrEqual(3);

    const list = await request(app.server)
      .get("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`);
    const zone = (list.body.data as { ref_id: string; kind: string; polygon: unknown[] }[]).find(
      (b) => b.ref_id === `${TEST_PREFIX}zone-1`
    );
    // Zona to‘liq yangi hudud ichida qolsa o‘chiriladi; qisman kesilsa polygon qoladi.
    if (zone) {
      expect(zone.polygon.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("incoming_wins trims zone when territory only partially overlaps", async () => {
    await cleanupTestBoundaries(token);
    await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "zone",
        ref_id: `${TEST_PREFIX}zone-2`,
        name: "Test Zona 2",
        polygon: POLY_A,
        clip_against_existing: false,
        color: "#0891b2"
      });

    const partialTerritory = [
      { lat: 41.33, lng: 69.24 },
      { lat: 41.36, lng: 69.24 },
      { lat: 41.36, lng: 69.27 },
      { lat: 41.33, lng: 69.27 }
    ];

    const res = await request(app.server)
      .put("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`)
      .send({
        kind: "territory",
        ref_id: `${TEST_PREFIX}territory-2`,
        name: "Test Territoriya 2",
        polygon: partialTerritory,
        clip_against_existing: false,
        overlap_resolution: "incoming_wins",
        color: "#16a34a"
      });
    expect(res.status).toBe(200);

    const list = await request(app.server)
      .get("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`);
    const zone = (list.body.data as { ref_id: string; polygon: unknown[] }[]).find(
      (b) => b.ref_id === `${TEST_PREFIX}zone-2`
    );
    expect(zone).toBeTruthy();
    expect(zone!.polygon.length).toBeGreaterThanOrEqual(3);
  });

  it("lists saved test boundaries by kind", async () => {
    const list = await request(app.server)
      .get("/api/test1/geo-boundaries")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const testRows = (list.body.data as { ref_id: string; kind: string }[]).filter((b) =>
      b.ref_id.startsWith(TEST_PREFIX)
    );
    expect(testRows.length).toBeGreaterThanOrEqual(2);
    const kinds = new Set(testRows.map((b) => b.kind));
    expect(kinds.has("zone")).toBe(true);
    expect(kinds.has("territory")).toBe(true);
  });
});
