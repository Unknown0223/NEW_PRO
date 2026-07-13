import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { getErrorCode } from "../../lib/app-error";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "../bonus-rules/bonus-rules.route.shared";
import {
  createAutoConfirmRule,
  createRestrictionRule,
  deleteAutoConfirmRule,
  deleteRestrictionRule,
  duplicateAutoConfirmRule,
  duplicateRestrictionRule,
  listAutoConfirmRules,
  listRestrictionRules,
  restoreAutoConfirmRule,
  restoreRestrictionRule,
  updateAutoConfirmRule,
  updateRestrictionRule,
  type ListQuery
} from "./order-automation.crud";
import { getOrderAutomationFormOptions } from "./order-automation.form-options";
import {
  autoConfirmCreateSchema,
  autoConfirmUpdateSchema,
  patchFieldSchema,
  restrictionCreateSchema,
  restrictionUpdateSchema
} from "./order-automation.route.schemas";

function parseListQuery(q: Record<string, string | undefined>): ListQuery {
  const page = Number.parseInt(q.page ?? "1", 10);
  const limit = Number.parseInt(q.limit ?? "50", 10);
  const agentId = Number.parseInt(q.agent_user_id ?? q.agent_id ?? "", 10);
  const warehouseId = Number.parseInt(q.warehouse_id ?? "", 10);
  return {
    page: Number.isFinite(page) ? page : 1,
    limit: Number.isFinite(limit) ? limit : 50,
    is_active: q.is_active === "true" ? true : q.is_active === "false" ? false : undefined,
    archive: q.archive === "true" || q.archive === "1",
    search: q.search,
    agent_user_id: Number.isFinite(agentId) && agentId > 0 ? agentId : undefined,
    warehouse_id: Number.isFinite(warehouseId) && warehouseId > 0 ? warehouseId : undefined,
    trade_direction_ref: q.trade_direction_ref ?? q.trade_direction,
    payment_method_ref: q.payment_method_ref ?? q.payment_type,
    zone: q.zone,
    region: q.region,
    city: q.city,
    execution_type: q.execution_type,
    request_type_ref: q.request_type_ref ?? q.request_type
  };
}

function csvEscape(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function registerOrderAutomationRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/order-automation/form-options",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await getOrderAutomationFormOptions(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/order-restriction-rules",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      if (q.export === "csv") {
        const result = await listRestrictionRules(request.tenant!.id, {
          ...parseListQuery(q),
          limit: 5000,
          page: 1
        });
        const headers = [
          "Названия",
          "Дата создания",
          "Дата изменения",
          "Валюта",
          "Сумма от",
          "Сумма до",
          "Агент",
          "Склады",
          "Способ оплаты",
          "Направление торговли",
          "Территории",
          "Консигнация",
          "Комментарий",
          "Активный"
        ];
        const rows = result.data.map((r) =>
          [
            r.name,
            r.created_at,
            r.updated_at,
            r.currency_code,
            r.amount_from ?? "",
            r.amount_to ?? "",
            r.agent_name ?? "",
            r.warehouse_names.join(";"),
            r.payment_method_ref ?? "",
            r.trade_direction_ref ?? "",
            r.territory_refs.join(";"),
            r.consignment_mode,
            r.comment,
            r.is_active ? "Да" : "Нет"
          ].map(csvEscape).join(",")
        );
        const csv = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows].join("\n");
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", 'attachment; filename="restriction-rules.csv"');
        return reply.send(csv);
      }
      const result = await listRestrictionRules(request.tenant!.id, parseListQuery(q));
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/order-restriction-rules",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = restrictionCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createRestrictionRule(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: (row as { id?: number })?.id ?? "—",
          action: "automation_rule.create",
          payload: { kind: "restriction", name: (row as { name?: string })?.name ?? null }
        });
        return reply.status(201).send({ data: row });
      } catch (e) {
        if (getErrorCode(e) === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/order-restriction-rules/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "InvalidId");
      const parsed = restrictionUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await updateRestrictionRule(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: id,
          action: "automation_rule.update",
          payload: { kind: "restriction", fields: Object.keys(parsed.data) }
        });
        return reply.send({ data: row });
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/order-restriction-rules/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      try {
        await deleteRestrictionRule(request.tenant!.id, id, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: id,
          action: "automation_rule.void",
          payload: { kind: "restriction", id, soft: true }
        });
        return reply.status(204).send();
      } catch (e) {
        const code = getErrorCode(e);
        if (code === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (code === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/order-restriction-rules/:id/restore",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      try {
        await restoreRestrictionRule(request.tenant!.id, id, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: id,
          action: "automation_rule.restore",
          payload: { kind: "restriction", id }
        });
        return reply.send({ ok: true });
      } catch (e) {
        const code = getErrorCode(e);
        if (code === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (code === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/order-restriction-rules/:id/duplicate",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      try {
        const row = await duplicateRestrictionRule(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request)
        );
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: (row as { id?: number })?.id ?? "—",
          action: "automation_rule.copy",
          payload: { kind: "restriction", source_id: id }
        });
        return reply.status(201).send({ data: row });
      } catch (e) {
        if (getErrorCode(e) === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/order-auto-confirm-rules",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      if (q.export === "csv") {
        const result = await listAutoConfirmRules(request.tenant!.id, {
          ...parseListQuery(q),
          limit: 5000,
          page: 1
        });
        const headers = [
          "Названия",
          "Дата создания",
          "Дата изменения",
          "Тип выполнения",
          "Точное время",
          "N",
          "Консигнация",
          "Валюта",
          "Сумма от",
          "Сумма до",
          "Агент",
          "Склады",
          "Способ оплаты",
          "Направление",
          "Тип заявки",
          "Источник",
          "Территории",
          "Кто создал",
          "Кто изменил",
          "Комментарий",
          "Активный"
        ];
        const rows = result.data.map((r) =>
          [
            r.name,
            r.created_at,
            r.updated_at,
            r.execution_type,
            r.execution_time ?? "",
            r.n_value ?? "",
            r.consignment_mode,
            r.currency_code,
            r.amount_from ?? "",
            r.amount_to ?? "",
            r.agent_name ?? "",
            r.warehouse_names.join(";"),
            r.payment_method_ref ?? "",
            r.trade_direction_ref ?? "",
            r.request_type_refs.join(";"),
            r.source_channels.join(";"),
            r.territory_refs.join(";"),
            r.created_by ?? "",
            r.updated_by ?? "",
            r.comment,
            r.is_active ? "Да" : "Нет"
          ].map(csvEscape).join(",")
        );
        const csv = "\uFEFF" + [headers.map(csvEscape).join(","), ...rows].join("\n");
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", 'attachment; filename="auto-confirm-rules.csv"');
        return reply.send(csv);
      }
      const result = await listAutoConfirmRules(request.tenant!.id, parseListQuery(q));
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/order-auto-confirm-rules",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = autoConfirmCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createAutoConfirmRule(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: (row as { id?: number })?.id ?? "—",
          action: "automation_rule.create",
          payload: { kind: "auto_confirm", name: (row as { name?: string })?.name ?? null }
        });
        return reply.status(201).send({ data: row });
      } catch (e) {
        if (getErrorCode(e) === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/order-auto-confirm-rules/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const parsed = autoConfirmUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await updateAutoConfirmRule(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: id,
          action: "automation_rule.update",
          payload: { kind: "auto_confirm", fields: Object.keys(parsed.data) }
        });
        return reply.send({ data: row });
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/order-auto-confirm-rules/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      try {
        await deleteAutoConfirmRule(request.tenant!.id, id, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: id,
          action: "automation_rule.void",
          payload: { kind: "auto_confirm", id, soft: true }
        });
        return reply.status(204).send();
      } catch (e) {
        const code = getErrorCode(e);
        if (code === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (code === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/order-auto-confirm-rules/:id/restore",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      try {
        await restoreAutoConfirmRule(request.tenant!.id, id, actorUserIdOrNull(request));
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: id,
          action: "automation_rule.restore",
          payload: { kind: "auto_confirm", id }
        });
        return reply.send({ ok: true });
      } catch (e) {
        const code = getErrorCode(e);
        if (code === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (code === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/order-auto-confirm-rules/:id/duplicate",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      try {
        const row = await duplicateAutoConfirmRule(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request)
        );
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          entityType: "automation_rule",
          entityId: (row as { id?: number })?.id ?? "—",
          action: "automation_rule.copy",
          payload: { kind: "auto_confirm", source_id: id }
        });
        return reply.status(201).send({ data: row });
      } catch (e) {
        if (getErrorCode(e) === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );
}
