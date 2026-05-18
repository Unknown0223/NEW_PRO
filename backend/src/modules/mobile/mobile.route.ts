import type { FastifyInstance } from "fastify";
import {
  mobileEnqueueBodySchema,
  mobileRegisterFcmBodySchema,
  mobileSyncDeltaBodySchema,
  mobileSyncFullBodySchema
} from "../../contracts/mobile.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";
import {
  enqueueOrder,
  getPendingCount,
  getMobileAgentConfigPayload,
  syncDelta,
  syncFull,
  registerFcmToken
} from "./mobile.service";

const mobileRoles = ["agent", "expeditor", "supervisor"] as const;

/** Agent-konfig — zakazlar/mijozlar/konfig kalitlari (`permission-catalog` + `legacy-permissions.generated`). */
const MOBILE_AGENT_CONFIG_ANY = [
  "orders.view",
  "orders.create",
  "orders.zakaz.spisok_zakazov",
  "orders.zakaz.prosmotr_zakaza",
  "orders.zakaz.sozdanie_zakaza",
  "clients.spisok_klientov",
  "clients.prosmotr_profilya_klienta",
  "staff.agent.konfiguratsii",
  "staff.agent.prosmotr_agenta"
] as const;

/** Sinxron + FCM — sklad + dashboard (supervisor mobil). */
const MOBILE_SYNC_AND_PUSH_ANY = [
  ...MOBILE_AGENT_CONFIG_ANY,
  "warehouse.view",
  "dashboard.view",
  "dashboard.supervayzer",
  "dashboard.prodazhi"
] as const;

/** Oflayn navbat / enqueue — zakaz yaratish. */
const MOBILE_OFFLINE_ORDER_ANY = ["orders.create", "orders.zakaz.sozdanie_zakaza"] as const;

const mobileJwtRoles = [jwtAccessVerify, requireRoles(...mobileRoles)] as const;

const mobileAgentConfigPreHandler = [...mobileJwtRoles, requireAnyPermission([...MOBILE_AGENT_CONFIG_ANY])] as const;
const mobileSyncPreHandler = [...mobileJwtRoles, requireAnyPermission([...MOBILE_SYNC_AND_PUSH_ANY])] as const;
const mobileOfflineOrderPreHandler = [...mobileJwtRoles, requireAnyPermission([...MOBILE_OFFLINE_ORDER_ANY])] as const;

function parseDateLike(raw: string | null | undefined): Date | null | undefined {
  if (!raw) return null;
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

export async function registerMobileRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-config — agent mobile policy (JWT)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-config",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      const result = await getMobileAgentConfigPayload(request.tenant!.id, userId);
      if (!result.ok) {
        return sendApiError(reply, request, 403, result.error);
      }
      return reply.send({
        user_id: result.user_id,
        mobile_config: result.mobile_config,
        agent_entitlements: result.agent_entitlements
      });
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/sync/full  — full data sync
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/sync/full",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileSyncFullBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const lastSyncAt = parseDateLike(parsed.data.last_sync_at);
      if (lastSyncAt === undefined) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid date format", {
          field: "last_sync_at"
        });
      }
      const userId = Number(getAccessUser(request).sub);

      const result = await syncFull(request.tenant!.id, userId, lastSyncAt);
      return reply.send(result);
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/sync/delta  — delta sync for single entity
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/sync/delta",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileSyncDeltaBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const lastSyncAt = parseDateLike(parsed.data.last_sync_at);
      if (lastSyncAt === undefined) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid date format", {
          field: "last_sync_at"
        });
      }
      const entityType = parsed.data.entity_type;
      const userId = Number(getAccessUser(request).sub);

      const result = await syncDelta(request.tenant!.id, userId, lastSyncAt, entityType);
      return reply.send(result);
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/orders/enqueue  — queue an offline order
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/orders/enqueue",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileEnqueueBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const offlineCreatedAtParsed = parseDateLike(parsed.data.offline_created_at);
      if (offlineCreatedAtParsed === undefined) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid date format", {
          field: "offline_created_at"
        });
      }
      const userId = Number(getAccessUser(request).sub);
      const offlineCreated = offlineCreatedAtParsed ?? new Date();

      const result = await enqueueOrder(
        request.tenant!.id,
        userId,
        parsed.data.client_local_id ?? parsed.data.client_id!,
        parsed.data.items,
        offlineCreated,
      );
      return reply.status(201).send(result);
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/orders/pending  — count pending offline orders
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/orders/pending",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      const result = await getPendingCount(request.tenant!.id, userId);
      return reply.send(result);
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/fcm/register  — register FCM device token
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/fcm/register",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileRegisterFcmBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      const token = parsed.data.token;
      const deviceType = parsed.data.device_type ?? "android";

      const result = await registerFcmToken(request.tenant!.id, userId, token, deviceType);
      return reply.send(result);
    },
  );

}
