import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


export function validatePolygon(polygon: unknown): { lat: number; lng: number }[] {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new Error("Polygon requires at least 3 points");
  }
  const pts: { lat: number; lng: number }[] = [];
  for (const p of polygon) {
    if (
      typeof p !== "object" ||
      p === null ||
      !("lat" in p) ||
      !("lng" in p) ||
      typeof (p as any).lat !== "number" ||
      typeof (p as any).lng !== "number"
    ) {
      throw new Error("Each polygon vertex must be {lat: number, lng: number}");
    }
    const lat = (p as { lat: number; lng: number }).lat;
    const lng = (p as { lat: number; lng: number }).lng;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("Coordinates out of range");
    }
    pts.push({ lat, lng });
  }
  // Close the ring if not already closed
  if (
    pts.length > 0 &&
    (pts[0].lat !== pts[pts.length - 1].lat ||
      pts[0].lng !== pts[pts.length - 1].lng)
  ) {
    pts.push({ ...pts[0] });
  }
  return pts;
}
