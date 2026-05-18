import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { getClientSalesAnalytics } from "./client-sales-analytics.service";
import {
  buildClientReconciliationXlsxBuffer,
  loadClientReconciliation,
  toClientReconciliationJson
} from "./client-reconciliation-data";
import {
  getClientDetail,
  getClientReconciliationPdfBuffer,
  listClientAuditLogs
} from "./clients.service";
import {
  defaultReconciliationRange,
  endOfLocalDay,
  parseLocalYmd,
  parseReconciliationDateRange
} from "./clients.route.schemas";

export async function registerClientDetailRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/clients/:id/audit",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const pageNum = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limitNum = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));
      try {
        const result = await listClientAuditLogs(request.tenant!.id, id, pageNum, limitNum);
        return reply.send(result);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id/reconciliation-pdf",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      let dateFrom: Date;
      let dateToEnd: Date;
      if ((q.date_from && q.date_from.trim()) || (q.date_to && q.date_to.trim())) {
        if (!q.date_from?.trim() || !q.date_to?.trim()) {
          return sendApiError(
            reply,
            request,
            400,
            "DateRangeIncomplete",
            "date_from va date_to ikkalasi ham YYYY-MM-DD ko‘rinishida yuborilishi kerak."
          );
        }
        const a = parseLocalYmd(q.date_from);
        const b = parseLocalYmd(q.date_to);
        if (!a || !b) {
          return sendApiError(reply, request, 400, "InvalidDate");
        }
        dateFrom = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0);
        dateToEnd = endOfLocalDay(b);
      } else {
        const d = defaultReconciliationRange();
        dateFrom = d.from;
        dateToEnd = d.toEnd;
      }
      try {
        const buf = await getClientReconciliationPdfBuffer(request.tenant!.id, id, dateFrom, dateToEnd);
        const ymd = (x: Date) =>
          `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
        const fname = `akt-sverka-client-${id}-${ymd(dateFrom)}_${ymd(dateToEnd)}.pdf`;
        return reply
          .header("Content-Type", "application/pdf")
          .header("Content-Disposition", `attachment; filename="${fname}"`)
          .send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_DATE_RANGE") {
          return sendApiError(reply, request, 400, "BadDateRange", "date_from date_to dan katta.");
        }
        if (msg === "DATE_RANGE_TOO_LONG") {
          return sendApiError(
            reply,
            request,
            400,
            "DateRangeTooLong",
            "Davr 400 kundan oshmasligi kerak."
          );
        }
        throw e;
      }
    }
  );


  app.get(
    "/api/:slug/clients/:id/reconciliation",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const dr = parseReconciliationDateRange(q);
      if (!dr.ok) {
        return sendApiError(reply, request, dr.status, dr.error, dr.message);
      }
      const { dateFrom, dateToEnd } = dr;
      try {
        const loaded = await loadClientReconciliation(request.tenant!.id, id, dateFrom, dateToEnd);
        return reply.send(toClientReconciliationJson(loaded));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_DATE_RANGE") {
          return sendApiError(reply, request, 400, "BadDateRange", "date_from date_to dan katta.");
        }
        if (msg === "DATE_RANGE_TOO_LONG") {
          return sendApiError(
            reply,
            request,
            400,
            "DateRangeTooLong",
            "Davr 400 kundan oshmasligi kerak."
          );
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id/reconciliation-xlsx",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const dr = parseReconciliationDateRange(q);
      if (!dr.ok) {
        return sendApiError(reply, request, dr.status, dr.error, dr.message);
      }
      const { dateFrom, dateToEnd } = dr;
      try {
        const loaded = await loadClientReconciliation(request.tenant!.id, id, dateFrom, dateToEnd);
        const buf = await buildClientReconciliationXlsxBuffer(loaded);
        const ymd = (x: Date) =>
          `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
        const fname = `akt-sverka-client-${id}-${ymd(dateFrom)}_${ymd(dateToEnd)}.xlsx`;
        return reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
          .header("Content-Disposition", `attachment; filename="${fname}"`)
          .send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_DATE_RANGE") {
          return sendApiError(reply, request, 400, "BadDateRange", "date_from date_to dan katta.");
        }
        if (msg === "DATE_RANGE_TOO_LONG") {
          return sendApiError(
            reply,
            request,
            400,
            "DateRangeTooLong",
            "Davr 400 kundan oshmasligi kerak."
          );
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsedParams = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const { id } = parsedParams.data;
      try {
        const row = await getClientDetail(request.tenant!.id, id);
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id/sales-analytics",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      let product_category_id: number | undefined;
      if (q.product_category_id?.trim()) {
        const n = Number.parseInt(q.product_category_id.trim(), 10);
        if (Number.isFinite(n) && n > 0) product_category_id = n;
      }
      let agent_ids: number[] | undefined;
      const agentIdsRaw = q.agent_ids?.trim();
      if (agentIdsRaw) {
        const parts = agentIdsRaw.split(/[,;\s]+/).map((s) => Number.parseInt(s.trim(), 10));
        const ids = parts.filter((n) => Number.isFinite(n) && n > 0);
        if (ids.length > 0) agent_ids = ids;
      }
      const noAgentRaw = q.no_agent?.trim().toLowerCase();
      const include_no_agent = noAgentRaw === "1" || noAgentRaw === "true" || noAgentRaw === "yes";
      try {
        const row = await getClientSalesAnalytics(request.tenant!.id, id, {
          date_from: q.date_from,
          date_to: q.date_to,
          status: q.status,
          order_type: q.order_type,
          consignment: q.consignment,
          product_category_id: product_category_id ?? null,
          payment_type: q.payment_type?.trim() || null,
          agent_ids: agent_ids ?? null,
          include_no_agent: include_no_agent || undefined
        });
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );
}
