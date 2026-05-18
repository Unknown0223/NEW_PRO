import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  requireRolesOrSkladchikAnyEntitlement,
  SKLADCHIK_ALL_ENTITLEMENT_KEYS
} from "../staff/skladchik-access.prehandler";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "../linkage/linkage.service";
import { catalogRoles } from "./reference.route.shared";
import { createWarehouseBody, patchWarehouseBody } from "./reference.route.schemas";
import {
  createWarehouseRow,
  deleteWarehouseRow,
  getWarehouseDetail,
  listWarehousePickers,
  listWarehousesForTenant,
  listWarehousesTable,
  updateWarehouseRow
} from "./reference.service";


export async function registerReferenceWarehouseRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/warehouses",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ALL_ENTITLEMENT_KEYS)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const selected = parseSelectedMastersFromQuery(q);
      const scope = await resolveConstraintScope(request.tenant!.id, selected);
      const data = await listWarehousesForTenant(
        request.tenant!.id,
        scope.constrained ? { allowed_ids: scope.warehouse_ids } : undefined
      );
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/warehouses/table",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ALL_ENTITLEMENT_KEYS)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const is_active =
        q.is_active === "true" ? true : q.is_active === "false" ? false : undefined;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "10", 10) || 10));
      const search = (q.q ?? "").trim();
      const result = await listWarehousesTable(request.tenant!.id, {
        is_active,
        q: search || undefined,
        page,
        limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/warehouses/pickers",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ALL_ENTITLEMENT_KEYS)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listWarehousePickers(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/warehouses/:warehouseId",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ALL_ENTITLEMENT_KEYS)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { warehouseId: string }).warehouseId, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await getWarehouseDetail(request.tenant!.id, id);
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: row });
    }
  );

  app.post(
    "/api/:slug/warehouses",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createWarehouseBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const row = await createWarehouseRow(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_NAME") return sendApiError(reply, request, 400, "EmptyName");
        if (msg === "NAME_EXISTS") return sendApiError(reply, request, 409, "WarehouseNameExists");
        if (msg === "UserNotFound") return sendApiError(reply, request, 400, "UserNotFound");
        if (msg === "UserRoleMismatch" || msg === "InvalidLinkRole") {
          return sendApiError(reply, request, 400, msg);
        }
        if (msg === "InvalidStockPurpose") {
          return sendApiError(reply, request, 400, "InvalidStockPurpose");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/warehouses/:warehouseId",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { warehouseId: string }).warehouseId, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchWarehouseBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const row = await updateWarehouseRow(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "EMPTY_NAME") return sendApiError(reply, request, 400, "EmptyName");
        if (msg === "NAME_EXISTS") return sendApiError(reply, request, 409, "WarehouseNameExists");
        if (msg === "EMPTY_PATCH") return sendApiError(reply, request, 400, "EmptyBody");
        if (msg === "UserNotFound") return sendApiError(reply, request, 400, "UserNotFound");
        if (msg === "UserRoleMismatch" || msg === "InvalidLinkRole") {
          return sendApiError(reply, request, 400, msg);
        }
        if (msg === "InvalidStockPurpose") {
          return sendApiError(reply, request, 400, "InvalidStockPurpose");
        }
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/warehouses/:warehouseId",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { warehouseId: string }).warehouseId, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await deleteWarehouseRow(request.tenant!.id, id, actorUserIdOrNull(request));
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "HAS_STOCK") return sendApiError(reply, request, 409, "WarehouseHasStock");
        if (msg === "HAS_ORDERS") return sendApiError(reply, request, 409, "WarehouseHasOrders");
        throw e;
      }
    }
  );
}
