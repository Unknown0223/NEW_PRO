import { prisma } from "../../config/database";
import { getTenantProfile } from "../tenant-settings/tenant-settings.profile.read";
import { assembleGpsMonitoringDay } from "./gps-monitoring.day-assemble";
import { refLabelMap } from "./gps-monitoring.day-mappers";
import { buildGpsEmployeeDto } from "./gps-monitoring.employees";
import { endOfLocalDay, startOfLocalDay } from "./gps-monitoring.helpers";
import type { GpsDayResponse } from "./gps-monitoring.types";

const clientGeoSelect = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true
} as const;

export async function getGpsMonitoringDay(
  tenantId: number,
  employeeId: number,
  dateIso: string
): Promise<GpsDayResponse | null> {
  const employee = await buildGpsEmployeeDto(tenantId, employeeId);
  if (!employee) return null;

  const from = startOfLocalDay(dateIso);
  const to = endOfLocalDay(dateIso);
  const dayUtc = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));

  const [routeDay, visits, orders, refusals, pings, payments, photos, profile] = await Promise.all([
    prisma.agentRouteDay.findUnique({
      where: {
        tenant_id_agent_id_route_date: {
          tenant_id: tenantId,
          agent_id: employeeId,
          route_date: dayUtc
        }
      },
      select: { stops: true }
    }),
    prisma.agentVisit.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: employeeId,
        checked_in_at: { gte: from, lte: to }
      },
      include: { client: { select: clientGeoSelect } },
      orderBy: { checked_in_at: "asc" }
    }),
    prisma.order.findMany({
      where: {
        tenant_id: tenantId,
        order_type: "order",
        created_at: { gte: from, lte: to },
        OR: [{ agent_id: employeeId }, { expeditor_user_id: employeeId }]
      },
      select: {
        id: true,
        client_id: true,
        total_sum: true,
        status: true,
        created_at: true,
        agent_id: true,
        expeditor_user_id: true,
        comment: true,
        request_type_ref: true,
        _count: { select: { items: true } },
        client: { select: clientGeoSelect }
      },
      orderBy: { created_at: "asc" }
    }),
    prisma.clientRefusal.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: employeeId,
        created_at: { gte: from, lte: to }
      },
      include: { client: { select: clientGeoSelect } },
      orderBy: { created_at: "asc" }
    }),
    prisma.agentLocationPing.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: employeeId,
        recorded_at: { gte: from, lte: to }
      },
      orderBy: { recorded_at: "asc" },
      take: 4000
    }),
    employee.type === "inkasator"
      ? prisma.payment.findMany({
          where: {
            tenant_id: tenantId,
            deleted_at: null,
            entry_kind: "payment",
            workflow_status: { not: "deleted" },
            OR: [{ created_by_user_id: employeeId }, { ledger_agent_id: employeeId }],
            created_at: { gte: from, lte: to }
          },
          select: {
            client_id: true,
            amount: true,
            payment_type: true,
            created_at: true,
            client: { select: clientGeoSelect }
          }
        })
      : Promise.resolve([]),
    prisma.clientPhotoReport.findMany({
      where: {
        tenant_id: tenantId,
        created_by_user_id: employeeId,
        deleted_at: null,
        created_at: { gte: from, lte: to }
      },
      select: {
        id: true,
        client_id: true,
        caption: true,
        created_at: true,
        image_url: true,
        content_purged_at: true
      },
      orderBy: { created_at: "asc" },
      take: 200
    }),
    getTenantProfile(tenantId)
  ]);

  return assembleGpsMonitoringDay({
    employee,
    employeeId,
    dateIso,
    routeStops: routeDay?.stops,
    visits,
    orders,
    refusals,
    pings,
    payments,
    photos,
    refusalLabels: refLabelMap(profile.references.refusal_reason_entries),
    requestTypeLabels: refLabelMap(profile.references.request_type_entries)
  });
}
