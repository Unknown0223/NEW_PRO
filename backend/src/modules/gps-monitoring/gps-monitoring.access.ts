import type { FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveUserPermissionKeys } from "../access/rbac.service";
import type { GpsEmployeeType } from "./gps-monitoring.types";

/** «GPS» bo'limi — har bir xodim turi alohida ruxsat (agentlar, dostavshiklar, ...). */
export const GPS_TYPE_VIEW_PERMISSION: Record<GpsEmployeeType, string> = {
  agent: "gps.agenty.view",
  delivery: "gps.dostavshchiki.view",
  supervisor: "gps.supervayzery.view",
  inkasator: "gps.inkassatory.view",
  vansell: "gps.van_selling.view"
};

export const GPS_TRACK_PERMISSION = "gps.trek.view";

export const GPS_MONITORING_VIEW_PERMISSIONS = [...Object.values(GPS_TYPE_VIEW_PERMISSION), GPS_TRACK_PERMISSION];

export type GpsAccess = {
  types: ReadonlySet<GpsEmployeeType>;
  track: boolean;
};

const ALL_TYPES = Object.keys(GPS_TYPE_VIEW_PERMISSION) as GpsEmployeeType[];

export async function resolveGpsAccess(request: FastifyRequest): Promise<GpsAccess> {
  const user = getAccessUser(request);
  const userId = Number(user.sub);
  if (env.RBAC_ENFORCE_PERMISSIONS !== "1" || user.role === "admin" || !Number.isInteger(userId) || userId < 1) {
    return { types: new Set(ALL_TYPES), track: true };
  }
  const keys = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
  return {
    types: new Set(ALL_TYPES.filter((t) => keys.has(GPS_TYPE_VIEW_PERMISSION[t]))),
    track: keys.has(GPS_TRACK_PERMISSION)
  };
}
