import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  requireRolesOrSkladchikEntitlement
} from "../staff/skladchik-access.prehandler";
import { ensureTenantContext } from "../../lib/tenant-context";
import { prisma } from "../../config/database";
import {
  buildWarehouseBlocksExportBuffer,
  confirmWarehouseBlockEmpty,
  createWarehouseBlock,
  deleteWarehouseBlock,
  listWarehouseBlocks,
  updateWarehouseBlock
} from "./warehouse-blocks.service";
import { listWarehousePickers, listWarehousesForTenant } from "../reference/reference.service";

const readRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor", "gruzchik"] as const;
const blockWriteBase = ADMIN_AND_OPERATOR_LIKE_ROLES;

const listQuerySchema = z.object({
  warehouse_id: z.coerce.number().int().positive().optional(),
  is_active: z.enum(["true", "false"]).optional(),
  q: z.string().max(500).optional().default(""),
  sort: z.enum(["name_asc", "name_desc", "sort_asc", "sort_desc"]).optional().default("sort_asc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(30)
});

const blockBodySchema = z.object({
  warehouse_id: z.number().int().positive(),
  name: z.string().min(1).max(300),
  code: z.string().max(20).nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
  comment: z.string().max(2000).nullable().optional(),
  expeditor_user_ids: z.array(z.number().int().positive()).max(1).optional().default([]),
  gruzchik_user_id: z.number().int().positive().nullable().optional()
});

function mapBlockError(reply: FastifyReply, request: FastifyRequest, e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
  if (msg === "BAD_EXPEDITOR_USER") return sendApiError(reply, request, 400, "BadExpeditorUser");
  if (msg === "BAD_GRUZCHIK_USER") return sendApiError(reply, request, 400, "BadGruzchikUser");
  if (msg === "TOO_MANY_EXPEDITORS") {
    return sendApiError(reply, request, 400, "TooManyExpeditors");
  }
  if (msg === "EMPTY_NAME") return sendApiError(reply, request, 400, "EmptyName");
  if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
  throw e;
}

export async function registerWarehouseBlockRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/warehouse-blocks/form-options",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(readRoles, "warehouse_block_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tid = request.tenant!.id;
      const [warehouses, pickers, gruzchikUsers] = await Promise.all([
        listWarehousesForTenant(tid),
        listWarehousePickers(tid),
        prisma.user.findMany({
          where: { tenant_id: tid, is_active: true, role: "gruzchik" },
          select: { id: true, name: true, login: true },
          orderBy: [{ name: "asc" }, { login: "asc" }]
        })
      ]);
      /** Blok ↔ bitta доставщик: tanlov faqat `expeditor` roli. */
      const expeditorCandidates = [...pickers.expeditors].sort((a, b) =>
        a.name.localeCompare(b.name, "ru", { sensitivity: "base" })
      );
      return reply.send({
        warehouses: warehouses.map((w) => ({ id: w.id, name: w.name })),
        expeditorCandidates,
        gruzchikCandidates: gruzchikUsers
      });
    }
  );

  app.get(
    "/api/:slug/warehouse-blocks/export",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(readRoles, "warehouse_block_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const q = parsed.data;
      const is_active = q.is_active === "true" ? true : q.is_active === "false" ? false : undefined;
      const buf = await buildWarehouseBlocksExportBuffer(request.tenant!.id, {
        warehouse_id: q.warehouse_id,
        is_active,
        q: q.q,
        sort: q.sort
      });
      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      reply.header("Content-Disposition", 'attachment; filename="warehouse-blocks.xlsx"');
      return reply.send(buf);
    }
  );

  app.get(
    "/api/:slug/warehouse-blocks",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(readRoles, "warehouse_block_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const q = parsed.data;
      const is_active = q.is_active === "true" ? true : q.is_active === "false" ? false : undefined;
      const data = await listWarehouseBlocks(request.tenant!.id, {
        warehouse_id: q.warehouse_id,
        is_active,
        q: q.q,
        sort: q.sort,
        page: q.page,
        limit: q.limit
      });
      return reply.send(data);
    }
  );

  app.post(
    "/api/:slug/warehouse-blocks",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(blockWriteBase, "warehouse_block_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = blockBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createWarehouseBlock(request.tenant!.id, parsed.data);
        return reply.status(201).send(row);
      } catch (e) {
        return mapBlockError(reply, request, e);
      }
    }
  );

  app.patch(
    "/api/:slug/warehouse-blocks/:id",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(blockWriteBase, "warehouse_block_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      const parsed = blockBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await updateWarehouseBlock(request.tenant!.id, id, parsed.data);
        return reply.send({ ok: true });
      } catch (e) {
        return mapBlockError(reply, request, e);
      }
    }
  );

  app.delete(
    "/api/:slug/warehouse-blocks/:id",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(blockWriteBase, "warehouse_block_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      try {
        await deleteWarehouseBlock(request.tenant!.id, id);
        return reply.send({ ok: true });
      } catch (e) {
        return mapBlockError(reply, request, e);
      }
    }
  );

  app.post(
    "/api/:slug/warehouse-blocks/:id/confirm-empty",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(blockWriteBase, "warehouse_block_confirm_empty")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      try {
        await confirmWarehouseBlockEmpty(request.tenant!.id, id);
        return reply.send({ ok: true });
      } catch (e) {
        return mapBlockError(reply, request, e);
      }
    }
  );
}
