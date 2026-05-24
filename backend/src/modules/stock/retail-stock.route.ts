import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import {
  buildRetailStockExportBuffer,
  buildRetailStockTemplateBuffer,
  importRetailStockFromXlsx,
  listRetailStock
} from "./retail-stock.service";

const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const importRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const listSchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  agent_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  product_id: z.coerce.number().int().positive().optional(),
  price_type: z.string().max(64).optional(),
  territory_1: z.string().max(128).optional(),
  territory_2: z.string().max(128).optional(),
  territory_3: z.string().max(128).optional(),
  view: z.enum(["products", "categories"]).optional().default("products"),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(30)
});

export async function registerRetailStockRoutes(app: FastifyInstance) {
  app.get("/api/:slug/retail-stock/template", {
    preHandler: [jwtAccessVerify, requireRoles(...importRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const buf = await buildRetailStockTemplateBuffer();
    reply.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    reply.header("Content-Disposition", 'attachment; filename="retail-stock-template.xlsx"');
    return reply.send(buf);
  });

  app.post("/api/:slug/retail-stock/upload", {
    preHandler: [jwtAccessVerify, requireRoles(...importRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const file = await request.file();
    if (!file) return sendApiError(reply, request, 400, "NoFile");
    const buf = await file.toBuffer();
    if (!buf || buf.length === 0) return sendApiError(reply, request, 400, "EmptyFile");
    const result = await importRetailStockFromXlsx(
      request.tenant!.id,
      buf,
      actorUserIdOrNull(request),
      file.filename || "retail-stock.xlsx"
    );
    return reply.send(result);
  });

  app.get("/api/:slug/retail-stock/export", {
    preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const q = parsed.data;
    const buf = await buildRetailStockExportBuffer(request.tenant!.id, q);
    reply.header(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    reply.header("Content-Disposition", 'attachment; filename="retail-stock.xlsx"');
    return reply.send(buf);
  });

  app.get("/api/:slug/retail-stock", {
    preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = listSchema.safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const data = await listRetailStock(request.tenant!.id, parsed.data);
    return reply.send(data);
  });
}
