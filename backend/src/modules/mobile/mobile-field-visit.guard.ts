import { prisma } from "../../config/database";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import {
  assertMobilePhotoReportForClient,
  loadAgentMobileConfig
} from "./mobile-agent-sync.config.service";
import { fieldVisitLocationBlock, photoReportIsRequired } from "./mobile-field-visit.pure";

export { photoReportIsRequired };

export function fieldVisitPolicyError(message: string): { status: number; code: string; text: string } | null {
  if (message === "PHOTO_REPORT_REQUIRED") {
    return { status: 400, code: "PhotoReportRequired", text: "Нужен сегодняшний фотоотчёт по этому клиенту" };
  }
  if (message === "GPS_REQUIRED") {
    return { status: 400, code: "GpsRequired", text: "Для визита нужна геолокация" };
  }
  if (message === "OUT_OF_RADIUS") {
    return { status: 400, code: "OutOfRadius", text: "Вы слишком далеко от торговой точки" };
  }
  return null;
}

/** Vizit yozishdan oldin: foto (ekspeditor / rad etish) va radius/GPS. */
export async function assertFieldVisitPolicy(
  tenantId: number,
  userId: number,
  role: string,
  input: {
    clientId: number;
    latitude?: number | null;
    longitude?: number | null;
    /** Agent «отказ» — foto majburiy bo‘lsa fotosiz rad yozilmaydi. */
    refusal?: boolean;
  }
): Promise<void> {
  const cfg = await loadAgentMobileConfig(tenantId, userId);
  if (role === "expeditor" || input.refusal) {
    await assertMobilePhotoReportForClient(tenantId, userId, input.clientId, cfg);
  }
  await assertFieldVisitLocation(tenantId, cfg, input);
}

/** Yetkazishni yopish (dostavleno / vozvrat) fotosiz o‘tmasin. */
export async function assertExpeditorCloseNeedsPhoto(
  tenantId: number,
  userId: number,
  clientId: number,
  cfg: AgentMobileConfigV1 | null
): Promise<void> {
  await assertMobilePhotoReportForClient(tenantId, userId, clientId, cfg);
}

async function assertFieldVisitLocation(
  tenantId: number,
  cfg: AgentMobileConfigV1 | null,
  input: { clientId: number; latitude?: number | null; longitude?: number | null }
): Promise<void> {
  const radius = cfg?.misc?.require_within_outlet_radius_m;
  const gpsRequired = cfg?.gps?.required_for_order === true;
  if (!(gpsRequired || (radius != null && radius > 0))) return;
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, tenant_id: tenantId },
    select: { latitude: true, longitude: true }
  });
  const block = fieldVisitLocationBlock({
    gpsRequired,
    radiusM: radius,
    latitude: input.latitude,
    longitude: input.longitude,
    clientLat: client?.latitude != null ? Number(client.latitude) : null,
    clientLng: client?.longitude != null ? Number(client.longitude) : null
  });
  if (block) throw new Error(block);
}
