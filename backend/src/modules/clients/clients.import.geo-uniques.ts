import { prisma } from "../../config/database";
import {
  CLIENT_GEO_SIMILAR_NAME_RADIUS_M,
  geoBoundingBox,
  haversineMeters,
  namesAreSimilar
} from "./client-quality-rules";
import type { ImportUpdateUniqueConflict } from "./clients.import.update-uniques";

export async function findNearbySimilarNameConflict(
  tenantId: number,
  clientId: number,
  patch: { name?: string | null; latitude?: number | null; longitude?: number | null }
): Promise<ImportUpdateUniqueConflict | null> {
  const name = patch.name != null ? String(patch.name).trim() : "";
  const lat = patch.latitude;
  const lon = patch.longitude;
  if (!name || lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  const box = geoBoundingBox(lat, lon, CLIENT_GEO_SIMILAR_NAME_RADIUS_M);
  const exclude = clientId > 0 ? { id: { not: clientId } } : {};
  const nearby = await prisma.client.findMany({
    where: {
      tenant_id: tenantId,
      merged_into_client_id: null,
      ...exclude,
      latitude: { gte: box.latMin, lte: box.latMax },
      longitude: { gte: box.lonMin, lte: box.lonMax }
    },
    select: { id: true, name: true, is_active: true, latitude: true, longitude: true },
    take: 80
  });

  for (const hit of nearby) {
    if (!namesAreSimilar(name, hit.name)) continue;
    const hLat = hit.latitude == null ? null : Number(hit.latitude);
    const hLon = hit.longitude == null ? null : Number(hit.longitude);
    if (hLat == null || hLon == null) continue;
    const meters = haversineMeters(lat, lon, hLat, hLon);
    if (meters <= CLIENT_GEO_SIMILAR_NAME_RADIUS_M) {
      return {
        field: "geo_name",
        value: `${Math.round(meters)}m`,
        otherClientId: hit.id,
        otherIsActive: hit.is_active
      };
    }
  }
  return null;
}
