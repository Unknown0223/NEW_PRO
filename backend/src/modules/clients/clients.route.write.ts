import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { z } from "zod";
import { patchClientBodySchema } from "../../contracts/clients.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import { createClientMinimal, updateClientFields } from "./clients.service";
import { bulkActiveBodySchema, createClientBodySchema } from "./clients.route.schemas";

export async function registerClientWriteRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/clients",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createClientBodySchema.safeParse(request.body);
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
        const actor = getAccessUser(request);
        const sub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const phone = parsed.data.phone?.trim() || null;
        if (!phone) {
          return sendApiError(reply, request, 400, "ValidationError", "Телефон обязателен.");
        }
        if (!parsed.data.region?.trim()) {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Территория (область) обязательна."
          );
        }
        if (parsed.data.latitude == null || parsed.data.longitude == null) {
          return sendApiError(reply, request, 400, "ValidationError", "Координаты обязательны.");
        }
        const { id } = await createClientMinimal(request.tenant!.id, actorUserId, {
          name: parsed.data.name,
          phone,
          category: parsed.data.category,
          client_type_code: parsed.data.client_type_code,
          region: parsed.data.region,
          district: parsed.data.district,
          city: parsed.data.city,
          neighborhood: parsed.data.neighborhood,
          zone: parsed.data.zone,
          client_format: parsed.data.client_format,
          sales_channel: parsed.data.sales_channel,
          product_category_ref: parsed.data.product_category_ref,
          logistics_service: parsed.data.logistics_service
        });
        await updateClientFields(
          request.tenant!.id,
          id,
          {
            legal_name: parsed.data.legal_name,
            address: parsed.data.address,
            responsible_person: parsed.data.responsible_person,
            landmark: parsed.data.landmark,
            inn: parsed.data.inn,
            working_hours: parsed.data.working_hours,
            notes: parsed.data.notes,
            client_code: parsed.data.client_code,
            latitude: parsed.data.latitude,
            longitude: parsed.data.longitude,
            is_active: parsed.data.is_active,
            agent_assignments: parsed.data.agent_assignments
          },
          actorUserId
        );
        return reply.status(201).send({ id });
      } catch (e) {
        if (e instanceof Error && e.message === "VALIDATION") {
          return sendApiError(reply, request, 400, "ValidationError");
        }
        if (e instanceof Error && e.message === "DUPLICATE_PHONE") {
          return sendApiError(reply, request, 409, "DuplicatePhone", "Bu telefon mavjud.");
        }
        if (e instanceof Error && e.message === "DUPLICATE_NAME") {
          return sendApiError(
            reply,
            request,
            409,
            "DuplicateName",
            "Shu nomga o‘xshash klient mavjud."
          );
        }
        if (e instanceof Error && e.message === "DUPLICATE_AGENT_DIRECTION") {
          return sendApiError(
            reply,
            request,
            409,
            "DuplicateAgentDirection",
            "Bir klientga bir xil agentni bir necha yo‘nalishga bog‘lab bo‘lmaydi. Har bir yo‘nalishda faqat bitta agent."
          );
        }
        if (e instanceof Error && e.message === "AGENT_NOT_FOUND") {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Tanlangan agent topilmadi yoki nofaol. Faol agentni qayta tanlang."
          );
        }
        if (e instanceof Error && e.message === "EXPEDITOR_NOT_FOUND") {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Tanlangan dastavchik topilmadi yoki nofaol. Faol dastavchikni qayta tanlang."
          );
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/clients/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchClientBodySchema.safeParse(request.body);
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
        const actor = getAccessUser(request);
        const sub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const body = parsed.data;
        const mapped = {
          ...body,
          contact_persons: body.contact_persons?.map((s) => ({
            firstName: s.firstName ?? null,
            lastName: s.lastName ?? null,
            phone: s.phone ?? null
          }))
        };
        const row = await updateClientFields(request.tenant!.id, id, mapped, actorUserId);
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "DUPLICATE_AGENT_DIRECTION") {
          return sendApiError(
            reply,
            request,
            409,
            "DuplicateAgentDirection",
            "Bir klientga bir xil agentni bir necha yo‘nalishga bog‘lab bo‘lmaydi. Har bir yo‘nalishda faqat bitta agent."
          );
        }
        if (msg === "AGENT_NOT_FOUND") {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Tanlangan agent topilmadi yoki nofaol. Faol agentni qayta tanlang."
          );
        }
        if (msg === "EXPEDITOR_NOT_FOUND") {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Tanlangan dastavchik topilmadi yoki nofaol. Faol dastavchikni qayta tanlang."
          );
        }
        if (msg === "VALIDATION" || msg === "EMPTY") {
          return sendApiError(
            reply,
            request,
            400,
            msg === "EMPTY" ? "EmptyBody" : "ValidationError",
            msg === "EMPTY" ? "Request body is empty" : "Проверьте поля формы (ПИНФЛ — 14 цифр, координаты, команда)"
          );
        }
        throw e;
      }
    }
  );
}
