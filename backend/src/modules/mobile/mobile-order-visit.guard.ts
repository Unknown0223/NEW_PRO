import type { FastifyReply, FastifyRequest } from "fastify";
import type { MobileOrderVisitInput } from "../../contracts/mobile-order-visit.schemas";
import { sendApiError } from "../../lib/api-error";
import { prisma } from "../../config/database";
import { recordAgentVisitCheckin } from "../field/field.service";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import {
  evaluateOrderVisit,
  ORDER_VISIT_ERROR_RU,
  type OrderVisitErrorCode,
  type OrderVisitGeo
} from "./mobile-order-visit.pure";

const LINK_WINDOW_MS = 10 * 60 * 1000;

export class OrderVisitError extends Error {
  constructor(
    public readonly code: OrderVisitErrorCode,
    public readonly meta?: Record<string, unknown>
  ) {
    super(code);
  }
}

export type PreparedOrderVisit = {
  visit: MobileOrderVisitInput | null;
  geo: OrderVisitGeo;
  startedAt: Date | null;
};

/** Yangi ilova versiyasi sarlavhasi bo‘lsa — vizitsiz mobil zakaz rad etiladi. */
export function isStrictOrderVisitRequest(request: FastifyRequest): boolean {
  const raw = request.headers["x-app-version"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" && v.trim().length > 0;
}

export async function prepareOrderVisit(
  tenantId: number,
  clientId: number,
  visit: MobileOrderVisitInput | null | undefined,
  config: AgentMobileConfigV1 | undefined,
  strict: boolean
): Promise<PreparedOrderVisit> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId },
    select: { latitude: true, longitude: true }
  });
  const result = evaluateOrderVisit({
    visit,
    clientId,
    clientLat: client?.latitude != null ? Number(client.latitude) : null,
    clientLng: client?.longitude != null ? Number(client.longitude) : null,
    configRadiusM: config?.misc?.require_within_outlet_radius_m ?? null,
    strict
  });
  if (!result.ok) throw new OrderVisitError(result.code, result.meta);
  return { visit: visit ?? null, geo: result.geo, startedAt: result.startedAt };
}

async function findOrCreateServerVisit(
  tenantId: number,
  agentId: number,
  prepared: PreparedOrderVisit
): Promise<number | null> {
  const v = prepared.visit;
  if (!v || !prepared.startedAt) return null;
  if (v.server_visit_id) {
    const own = await prisma.agentVisit.findFirst({
      where: { id: v.server_visit_id, tenant_id: tenantId, agent_id: agentId, client_id: v.client_id },
      select: { id: true }
    });
    if (own) return own.id;
  }
  const t = prepared.startedAt.getTime();
  const near = await prisma.agentVisit.findFirst({
    where: {
      tenant_id: tenantId,
      agent_id: agentId,
      client_id: v.client_id,
      checked_in_at: { gte: new Date(t - LINK_WINDOW_MS), lte: new Date(t + LINK_WINDOW_MS) }
    },
    orderBy: { checked_in_at: "desc" },
    select: { id: true }
  });
  if (near) return near.id;
  const created = await recordAgentVisitCheckin(tenantId, agentId, {
    client_id: v.client_id,
    latitude: v.latitude,
    longitude: v.longitude,
    notes: "order-visit",
    checked_in_at: prepared.startedAt
  });
  return created.id;
}

/** Zakaz yaratilgach: vizitni bog‘lash (oflayn bo‘lsa serverda yaratish) va GPS natijasini yozish. */
export async function attachOrderVisit(
  tenantId: number,
  agentId: number,
  orderId: number,
  prepared: PreparedOrderVisit
): Promise<void> {
  const visitId = await findOrCreateServerVisit(tenantId, agentId, prepared);
  await prisma.order.update({
    where: { id: orderId },
    data: { agent_visit_id: visitId, visit_geo: prepared.geo }
  });
}

export function sendOrderVisitError(reply: FastifyReply, request: FastifyRequest, e: OrderVisitError) {
  const code = e.code
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  return sendApiError(reply, request, 400, code, ORDER_VISIT_ERROR_RU[e.code], e.meta);
}
