import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify } from "../auth/auth.prehandlers";
import { getUserUiPreferences, patchUserUiPreferences } from "./user-ui-preferences.service";

/** Jadval sozlamalari: ustun tartibi, yashirin ustunlar, sahifa o‘lchami, ko‘rinish */
const tableStateSchema = z
  .object({
    columnOrder: z.array(z.string().max(80)).max(100).optional(),
    hiddenColumnIds: z.array(z.string().max(80)).max(100).optional(),
    pageSize: z.number().int().min(5).max(2000).optional(),
    viewMode: z.enum(["grid", "list"]).optional()
  })
  .strict();

const patchUiPrefsSchema = z
  .object({
    tables: z.record(z.string().min(1).max(80), tableStateSchema).optional(),
    order_create: z
      .object({
        show_payment_method_selector: z.boolean().optional()
      })
      .strict()
      .optional(),
    reports: z
      .object({
        hidden_menu_item_hrefs: z.array(z.string().min(1).max(200)).max(200).optional()
      })
      .strict()
      .optional()
  })
  .strict()
  .refine((o) => o.tables == null || Object.keys(o.tables).length <= 80, {
    message: "TooManyTables",
    path: ["tables"]
  });

export async function registerUserUiRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/me/ui-preferences",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const jwt = getAccessUser(request);
      const userId = Number.parseInt(jwt.sub, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return sendApiError(reply, request, 400, "BadUserId");
      }
      if (Number(jwt.tenantId) !== request.tenant!.id) {
        return sendApiError(reply, request, 403, "CrossTenantDenied");
      }
      try {
        const data = await getUserUiPreferences(request.tenant!.id, userId);
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/me/ui-preferences",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const jwt = getAccessUser(request);
      const userId = Number.parseInt(jwt.sub, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return sendApiError(reply, request, 400, "BadUserId");
      }
      if (Number(jwt.tenantId) !== request.tenant!.id) {
        return sendApiError(reply, request, 403, "CrossTenantDenied");
      }
      const parsed = patchUiPrefsSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const data = await patchUserUiPreferences(request.tenant!.id, userId, parsed.data);
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "UI_PREFS_TOO_LARGE") {
          return sendApiError(reply, request, 400, "UiPreferencesTooLarge");
        }
        throw e;
      }
    }
  );
}
