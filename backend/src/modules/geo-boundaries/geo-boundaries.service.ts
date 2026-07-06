import { prisma } from "../../config/database";
import type { GeoBoundaryDto, GeoBoundaryKind, GeoBoundaryUpsertInput } from "./geo-boundaries.types";
import { GeoBoundaryOverlapError } from "./geo-boundary-overlap.error";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { withLockedTenantSettings } from "../tenant-settings/tenant-settings.atomic";
import {
  clipPolygonOutsideObstacles,
  pointInPolygon,
  polygonsHaveAreaOverlap,
  subtractPolygons,
  validatePolygonPoints
} from "./geo-polygon.util";

const BOUNDARY_PALETTE = [
  "#7c3aed",
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#db2777",
  "#ea580c",
  "#0f766e",
  "#ca8a04",
  "#4f46e5",
  "#be123c"
] as const;

function normalizeHexColor(raw: string | undefined): string | undefined {
  const h = String(raw ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return undefined;
  return h.toLowerCase();
}

function pickAutoColor(existing: GeoBoundaryDto[]): string {
  const used = new Set(existing.map((b) => (b.color ?? "").toLowerCase()).filter(Boolean));
  for (const c of BOUNDARY_PALETTE) {
    if (!used.has(c)) return c;
  }
  return BOUNDARY_PALETTE[existing.length % BOUNDARY_PALETTE.length]!;
}

const REF_KEY = "geo_boundaries";

function chunkIds(ids: number[], max = 500): number[][] {
  if (ids.length <= max) return [ids];
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += max) out.push(ids.slice(i, i + max));
  return out;
}

function parseBoundary(raw: unknown): GeoBoundaryDto | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind !== "branch" && kind !== "zone" && kind !== "territory") return null;
  const id = String(o.id ?? "").trim();
  const ref_id = String(o.ref_id ?? "").trim();
  const name = String(o.name ?? "").trim();
  if (!id || !ref_id || !name) return null;
  let polygon: GeoBoundaryDto["polygon"] = [];
  try {
    polygon = validatePolygonPoints(o.polygon);
  } catch {
    polygon = [];
  }
  const color = normalizeHexColor(typeof o.color === "string" ? o.color : undefined);
  const warehouse_id = parseOptionalPositiveInt(o.warehouse_id);
  const cash_desk_id = parseOptionalPositiveInt(o.cash_desk_id);
  return {
    id,
    kind,
    ref_id,
    name,
    polygon,
    ...(color ? { color } : {}),
    ...(warehouse_id !== undefined ? { warehouse_id } : {}),
    ...(cash_desk_id !== undefined ? { cash_desk_id } : {}),
    updated_at: String(o.updated_at ?? new Date().toISOString())
  };
}

function parseOptionalPositiveInt(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function readBoundaries(tenantId: number): Promise<GeoBoundaryDto[]> {
  const row = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const refs = asRecord(asRecord(row?.settings)?.references);
  const arr = refs?.[REF_KEY];
  if (!Array.isArray(arr)) return [];
  return arr.map(parseBoundary).filter((x): x is GeoBoundaryDto => x != null);
}

async function writeBoundaries(tenantId: number, list: GeoBoundaryDto[]): Promise<void> {
  await withLockedTenantSettings(tenantId, (settings) => {
    const refs = asRecord(settings.references);
    return {
      ...settings,
      references: { ...refs, [REF_KEY]: list }
    };
  });
}

function newId(): string {
  return `gb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function listGeoBoundaries(tenantId: number): Promise<GeoBoundaryDto[]> {
  return readBoundaries(tenantId);
}

export async function upsertGeoBoundary(
  tenantId: number,
  input: GeoBoundaryUpsertInput
): Promise<{ boundary: GeoBoundaryDto; clipped: boolean; clients_assigned: number }> {
  const kind = input.kind;
  const ref_id = input.ref_id.trim();
  const name = input.name.trim();
  if (!ref_id || !name) throw new Error("ref_id and name required");

  let polygon = validatePolygonPoints(input.polygon);
  const all = await readBoundaries(tenantId);
  const others = all.filter((b) => !(b.kind === kind && b.ref_id === ref_id));
  const overlapping = others.filter(
    (b) => b.polygon.length >= 3 && polygonsHaveAreaOverlap(polygon, b.polygon)
  );

  let clipped = false;
  let nextList = [...all];

  if (overlapping.length > 0) {
    const resolution = input.overlap_resolution;
    if (!resolution) {
      if (input.clip_against_existing === true) {
        const obstacles = overlapping.map((b) => b.polygon);
        const res = clipPolygonOutsideObstacles(polygon, obstacles);
        clipped = res.clipped;
        if (!res.valid) {
          throw new GeoBoundaryOverlapError(
            overlapping.map((b) => ({ id: b.id, kind: b.kind, ref_id: b.ref_id, name: b.name }))
          );
        }
        polygon = res.polygon;
      } else {
        throw new GeoBoundaryOverlapError(
          overlapping.map((b) => ({ id: b.id, kind: b.kind, ref_id: b.ref_id, name: b.name }))
        );
      }
    } else if (resolution === "existing_wins") {
      const obstacles = overlapping.map((b) => b.polygon);
      const res = clipPolygonOutsideObstacles(polygon, obstacles);
      clipped = res.clipped;
      if (!res.valid) {
        throw new Error(
          "Yangi chegara mavjud chegaralar ichida qolmasligi kerak — yonidan chizing."
        );
      }
      polygon = res.polygon;
    } else {
      const incomingObstacle = [polygon];
      const removedIds: string[] = [];
      for (const obs of overlapping) {
        const res = subtractPolygons(obs.polygon, incomingObstacle);
        clipped = clipped || res.clipped;
        if (res.removed || !res.valid || res.polygon.length < 3) {
          removedIds.push(obs.id);
          continue;
        }
        nextList = nextList.map((b) =>
          b.id === obs.id ? { ...b, polygon: res.polygon, updated_at: new Date().toISOString() } : b
        );
      }
      if (removedIds.length > 0) {
        nextList = nextList.filter((b) => !removedIds.includes(b.id));
        clipped = true;
      }
    }
  }

  const existingIdx = nextList.findIndex((b) => b.kind === kind && b.ref_id === ref_id);
  const prev = existingIdx >= 0 ? nextList[existingIdx]! : null;
  const prevColor = prev?.color;
  const color = normalizeHexColor(input.color) ?? prevColor ?? pickAutoColor(nextList);
  const warehouse_id =
    input.warehouse_id !== undefined ? input.warehouse_id : (prev?.warehouse_id ?? null);
  const cash_desk_id =
    input.cash_desk_id !== undefined ? input.cash_desk_id : (prev?.cash_desk_id ?? null);

  if (warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouse_id, tenant_id: tenantId, is_active: true }
    });
    if (!wh) throw new Error("warehouse_id invalid");
  }
  if (cash_desk_id != null) {
    const cd = await prisma.cashDesk.findFirst({
      where: { id: cash_desk_id, tenant_id: tenantId, is_active: true }
    });
    if (!cd) throw new Error("cash_desk_id invalid");
  }

  const boundary: GeoBoundaryDto = {
    id: prev?.id ?? newId(),
    kind,
    ref_id,
    name,
    polygon,
    color,
    warehouse_id,
    cash_desk_id,
    updated_at: new Date().toISOString()
  };

  const next =
    existingIdx >= 0 ? nextList.map((b, i) => (i === existingIdx ? boundary : b)) : [...nextList, boundary];
  await writeBoundaries(tenantId, next);

  let clients_assigned = await assignClientsToBoundary(tenantId, boundary);
  if (overlapping.length > 0 && input.overlap_resolution === "incoming_wins") {
    for (const obs of overlapping) {
      const updated = next.find((b) => b.id === obs.id);
      if (updated) clients_assigned += await assignClientsToBoundary(tenantId, updated);
    }
  }
  return { boundary, clipped, clients_assigned };
}

export async function deleteGeoBoundary(tenantId: number, id: string): Promise<void> {
  const all = await readBoundaries(tenantId);
  await writeBoundaries(
    tenantId,
    all.filter((b) => b.id !== id)
  );
}

function patchForKind(
  kind: GeoBoundaryKind,
  name: string,
  levels: string[]
): Record<string, string | number | null> {
  if (kind === "branch") return { zone: name };
  if (kind === "zone") return { zone: name };
  if (kind === "territory") {
    if (levels.length >= 4) return { district: name };
    if (levels.length >= 3) return { city: name };
    if (levels.length === 2) return { city: name };
    return { region: name };
  }
  return { region: name };
}

function patchForBoundary(
  boundary: GeoBoundaryDto,
  levels: string[]
): Record<string, string | number | null> {
  const patch = patchForKind(boundary.kind, boundary.name, levels);
  if (boundary.warehouse_id != null) patch.warehouse_id = boundary.warehouse_id;
  if (boundary.cash_desk_id != null) patch.cash_desk_id = boundary.cash_desk_id;
  return patch;
}

export async function assignClientsToBoundary(tenantId: number, boundary: GeoBoundaryDto): Promise<number> {
  if (boundary.polygon.length < 3) return 0;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const refs = asRecord(asRecord(tenant?.settings)?.references);
  const levels = Array.isArray(refs?.territory_levels)
    ? (refs!.territory_levels as unknown[]).map((x) => String(x))
    : [];

  const patchFields = patchForBoundary(boundary, levels);

  const clients = await prisma.client.findMany({
    where: {
      tenant_id: tenantId,
      merged_into_client_id: null,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: { id: true, latitude: true, longitude: true }
  });

  const ids: number[] = [];
  for (const c of clients) {
    const lat = Number(c.latitude);
    const lng = Number(c.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (pointInPolygon(lat, lng, boundary.polygon)) {
      ids.push(c.id);
      continue;
    }
    if (lat > 50 && lng < 50 && pointInPolygon(lng, lat, boundary.polygon)) ids.push(c.id);
  }
  if (ids.length === 0) return 0;

  let updated = 0;
  for (const chunk of chunkIds(ids, 500)) {
    await prisma.client.updateMany({
      where: { tenant_id: tenantId, id: { in: chunk } },
      data: patchFields
    });
    updated += chunk.length;
  }
  return updated;
}

export async function assignClientsInBoundaryById(tenantId: number, boundaryId: string): Promise<number> {
  const all = await readBoundaries(tenantId);
  const b = all.find((x) => x.id === boundaryId);
  if (!b) throw new Error("Boundary not found");
  return assignClientsToBoundary(tenantId, b);
}
