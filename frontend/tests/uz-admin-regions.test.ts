import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  findAdminRegionForGps,
  findAdminRegionForToken,
  buildAdminRegionReferencePolygons,
  type UzAdminRegion
} from "@/lib/uz-admin-regions";

function loadRegionsFromFixture(): UzAdminRegion[] {
  const file = path.join(process.cwd(), "public/data/uz-admin-regions.geojson");
  const geo = JSON.parse(fs.readFileSync(file, "utf8")) as {
    features: {
      properties: { ADM1_UZ: string; ADM1_EN: string; ADM1_RU: string };
      geometry: { type?: string; coordinates?: unknown; geometries?: { type?: string; coordinates?: unknown }[] };
    }[];
  };

  return geo.features.map((f, index) => {
    const rings: { lat: number; lng: number }[][] = [];
    const geom = f.geometry;
    const pushPoly = (type?: string, coords?: unknown) => {
      if (type === "Polygon" && Array.isArray(coords) && Array.isArray((coords as number[][][])[0])) {
        const ring = (coords as number[][][])[0]!.map(([lng, lat]) => ({ lat, lng }));
        if (ring.length >= 3) rings.push(ring);
      }
      if (type === "MultiPolygon" && Array.isArray(coords)) {
        for (const poly of coords as number[][][][]) {
          const ring = poly[0]!.map(([lng, lat]) => ({ lat, lng }));
          if (ring.length >= 3) rings.push(ring);
        }
      }
    };
    pushPoly(geom.type, geom.coordinates);
    if (geom.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
      for (const g of geom.geometries) pushPoly(g.type, g.coordinates);
    }
    return {
      id: `uz-adm1-${index}`,
      nameUz: f.properties.ADM1_UZ,
      nameEn: f.properties.ADM1_EN,
      nameRu: f.properties.ADM1_RU,
      rings
    } satisfies UzAdminRegion;
  });
}

describe("uz-admin-regions", () => {
  const regions = loadRegionsFromFixture();

  it("loads 14 viloyat chegaralari", () => {
    expect(regions.length).toBe(14);
    expect(regions.every((r) => r.rings.length > 0)).toBe(true);
  });

  it("Toshkent shahar va viloyatini ajratadi", () => {
    const city = findAdminRegionForToken("TOSHKENT SHAHAR", regions);
    const vil = findAdminRegionForToken("TOSHKENT VILOYATI", regions);
    expect(city?.nameEn).toMatch(/city/i);
    expect(vil?.nameEn).toMatch(/region/i);
    expect(city?.id).not.toBe(vil?.id);
  });

  it("GPS nuqtasi viloyat ichida aniqlanadi", () => {
    const fromGps = findAdminRegionForGps(41.3111, 69.2797, regions);
    expect(fromGps?.nameEn).toMatch(/city/i);
  });

  it("fon uchun sezilarli viloyat chegaralari", () => {
    const refs = buildAdminRegionReferencePolygons(regions);
    expect(refs.length).toBeGreaterThan(regions.length);
    expect(refs.every((p) => p.subtle === true)).toBe(true);
    expect(refs.every((p) => p.coords.length >= 3)).toBe(true);
  });
});
