import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


export async function validateCheckin(
  tenantId: number,
  territoryId: number | null,
  lat: number,
  lng: number
): Promise<{
  inside: boolean;
  territory_id: number | null;
  territory_name: string | null;
}> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { inside: false, territory_id: null, territory_name: null };
  }

  const where: Prisma.TerritoryWhereInput = { tenant_id: tenantId, is_active: true, deleted_at: null };
  if (territoryId !== null) where.id = territoryId;

  const territories = await prisma.territory.findMany({ where });

  for (const t of territories) {
    const pts = t.polygon as unknown as { lat: number; lng: number }[];
    if (!Array.isArray(pts) || pts.length < 3) continue;

    if (isPointInPolygon(lat, lng, pts)) {
      return { inside: true, territory_id: t.id, territory_name: t.name };
    }
  }

  return { inside: false, territory_id: null, territory_name: null };
}

/**
 * Ray-casting point-in-polygon (crossing number algorithm).
 * Works with flat {lat, lng} arrays. First point is NOT assumed to repeat at end.
 */
function isPointInPolygon(
  lat: number,
  lng: number,
  vertices: { lat: number; lng: number }[]
): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    const intersects =
      vi.lat > lat !== vj.lat > lat &&
      lng <
        ((vj.lng - vi.lng) * (lat - vi.lat)) / (vj.lat - vi.lat) + vi.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Point-in-polygon check executed as raw PostgreSQL SQL.
 * Uses the ray-casting algorithm with jsonb_array_elements + LEAD() window function on the DB side.
 */
export async function pointInPolygonSQL(
  territoryId: number,
  tenantId: number,
  lat: number,
  lng: number
): Promise<boolean> {
  // Verify the territory exists and belongs to the tenant
  const territory = await prisma.territory.findFirst({
    where: { id: territoryId, tenant_id: tenantId, deleted_at: null },
    select: { id: true }
  });
  if (!territory) return false;

  try {
    const result = await prisma.$queryRaw<Array<{ inside: boolean }>>(
      Prisma.sql`
        WITH edges AS (
          SELECT
            row_num,
            elem.v->>'lat' AS lat_str,
            elem.v->>'lng' AS lng_str,
            LEAD(elem.v->>'lat') OVER (ORDER BY row_num) AS next_lat_str,
            LEAD(elem.v->>'lng') OVER (ORDER BY row_num) AS next_lng_str
          FROM territories t
          CROSS JOIN LATERAL (
            SELECT value AS v, ordinality AS row_num
            FROM jsonb_array_elements(t.polygon::jsonb)
          ) AS elem
          WHERE t.id = ${territoryId}
        )
        SELECT (
          COALESCE(SUM(
            CASE WHEN (
              (edges.lat_str::float > ${lat}) <> (COALESCE(edges.next_lat_str, first_lat.first) > ${lat})
              AND ${lng}::float < (
                (COALESCE(edges.next_lng_str, first_lng.first)::float - edges.lng_str::float)
                / (COALESCE(edges.next_lat_str, first_lat.first)::float - edges.lat_str::float)
                * (${lat} - edges.lat_str::float)
                + edges.lng_str::float
              )
            ) THEN 1 ELSE 0 END
          )::int % 2, 0) = 1
        ) AS inside
        FROM edges
        CROSS JOIN LATERAL (
          SELECT elem.v->>'lat' AS first
          FROM territories t
          CROSS JOIN LATERAL jsonb_array_elements(t.polygon::jsonb) AS elem
          WHERE t.id = ${territoryId}
          LIMIT 1
        ) first_lat
        CROSS JOIN LATERAL (
          SELECT elem.v->>'lng' AS first
          FROM territories t
          CROSS JOIN LATERAL jsonb_array_elements(t.polygon::jsonb) AS elem
          WHERE t.id = ${territoryId}
          LIMIT 1
        ) first_lng
        WHERE edges.next_lat_str IS NOT NULL
           OR (
             edges.lat_str::float <> first_lat.first::float
          )
      `
    );
    if (!result || result.length === 0) return false;
    return Boolean(result[0].inside);
  } catch {
    // Fallback to JS if raw SQL fails
    const t = await prisma.territory.findFirst({
      where: { id: territoryId, tenant_id: tenantId },
      select: { polygon: true }
    });
    if (!t) return false;
    const pts = t.polygon as unknown as { lat: number; lng: number }[];
    if (!Array.isArray(pts) || pts.length < 3) return false;
    return isPointInPolygon(lat, lng, pts);
  }
}
