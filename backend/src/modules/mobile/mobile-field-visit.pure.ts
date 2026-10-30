import { distanceMeters, MAX_ACCURACY_TOLERANCE_M } from "./mobile-order-visit.pure";

/** Ish joyi «фото при заказе» yoki ekspeditor «фото перед визитом». */
export function photoReportIsRequired(
  cfg:
    | {
        photo?: { required_for_order?: boolean } | null;
        expeditor?: { require_photo_report_before_visit?: boolean } | null;
      }
    | null
    | undefined
): boolean {
  return (
    cfg?.photo?.required_for_order === true ||
    cfg?.expeditor?.require_photo_report_before_visit === true
  );
}

export type VisitLocationBlock = "GPS_REQUIRED" | "OUT_OF_RADIUS";

/**
 * Radius yoki «GPS majburiy» yoqilgan bo‘lsa, vizitni qurilma koordinatasiz
 * yoki nuqtadan uzoqda qabul qilmaydi. Mijozda koordinata yo‘q bo‘lsa masofa
 * o‘lchanmaydi.
 */
export function fieldVisitLocationBlock(input: {
  gpsRequired: boolean;
  radiusM: number | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  clientLat: number | null;
  clientLng: number | null;
}): VisitLocationBlock | null {
  const radius = input.radiusM != null && input.radiusM > 0 ? input.radiusM : null;
  const hasFix =
    input.latitude != null &&
    input.longitude != null &&
    Number.isFinite(input.latitude) &&
    Number.isFinite(input.longitude);
  if ((input.gpsRequired || radius != null) && !hasFix) return "GPS_REQUIRED";
  if (radius == null || input.clientLat == null || input.clientLng == null || !hasFix) return null;
  const distance = distanceMeters(input.latitude!, input.longitude!, input.clientLat, input.clientLng);
  if (distance > radius + MAX_ACCURACY_TOLERANCE_M) return "OUT_OF_RADIUS";
  return null;
}
