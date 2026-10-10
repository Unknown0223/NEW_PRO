/**
 * ЗАРПЛАТА — API marshrutlari.
 *
 * Ruxsatlar: `staff.zarplaty.*` katalogi + rol darajasi (plans moduli bilan bir xil yondashuv).
 * Har bir marshrutda `ensureTenantContext` majburiy (tenant izolatsiyasi).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  createFormula,
  createGrid,
  listAssignments,
  listFormulas,
  listGrids,
  patchFormula,
  patchGrid,
  saveAssignments
} from "./payroll.crud";
import { calculateMonth, listPeriods, setPeriodStatus } from "./payroll.period";
import { listEntries, patchEntry } from "./payroll.entries";
import { createPayment, listPayrollOptions, listPayments, voidPayment } from "./payroll.payments";
import {
  assignmentsBodySchema,
  calcQuerySchema,
  entryPatchBodySchema,
  formulaCreateBodySchema,
  formulaPatchBodySchema,
  gridCreateBodySchema,
  gridPatchBodySchema,
  monthSchema,
  paymentCreateBodySchema,
  paymentsQuerySchema
} from "./payroll.schema";

const readRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const manageRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES] as const;
const approveRoles = ["admin", "accountant", "director", "sales_director"] as const;

function parseId(raw: unknown): number | null {
  const id = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function mapPayrollError(err: unknown, reply: FastifyReply, request: FastifyRequest) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
  if (msg === "DUPLICATE_CODE") return sendApiError(reply, request, 409, "DuplicateCode");
  if (msg === "PERIOD_LOCKED") return sendApiError(reply, request, 409, "PayrollPeriodLocked");
  if (msg === "PERIOD_PAID") return sendApiError(reply, request, 409, "PayrollPeriodPaid");
  if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
  if (
    msg === "BAD_KPI_GROUP" ||
    msg === "BAD_USER" ||
    msg === "BAD_PERIOD" ||
    msg === "BAD_USER_IDS" ||
    msg === "BAD_FORMULA_IDS"
  ) {
    return sendApiError(reply, request, 400, "ValidationError", msg);
  }
  throw err;
}

export async function registerPayrollRoutes(app: FastifyInstance) {
  const preRead = [jwtAccessVerify, requireRoles(...readRoles)];
  const preManage = [jwtAccessVerify, requireRoles(...manageRoles)];
  const preApprove = [jwtAccessVerify, requireRoles(...approveRoles)];

  app.get("/api/:slug/payroll/options", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await listPayrollOptions(request.tenant!.id);
    return reply.send({ data });
  });

  // ── Formulalar ──────────────────────────────────────────────
  app.get("/api/:slug/payroll/formulas", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await listFormulas(request.tenant!.id, {
      is_active: q.is_active === "true" ? true : q.is_active === "false" ? false : undefined,
      kpi_group_id: parseId(q.kpi_group_id) ?? undefined,
      role: q.role,
      search: q.search?.trim() || q.q?.trim()
    });
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/formulas", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = formulaCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const id = await createFormula(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
      return reply.status(201).send({ data: { id } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  app.patch("/api/:slug/payroll/formulas/:id", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = parseId((request.params as { id: string }).id);
    if (id == null) return sendApiError(reply, request, 400, "ValidationError");
    const parsed = formulaPatchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      await patchFormula(request.tenant!.id, id, parsed.data, actorUserIdOrNull(request));
      return reply.send({ data: { ok: true } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  // ── Сеткаlar ────────────────────────────────────────────────
  app.get("/api/:slug/payroll/grids", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await listGrids(request.tenant!.id, {
      is_active: q.is_active === "true" ? true : q.is_active === "false" ? false : undefined,
      kpi_group_id: parseId(q.kpi_group_id) ?? undefined,
      search: q.search?.trim() || q.q?.trim()
    });
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/grids", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = gridCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const id = await createGrid(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
      return reply.status(201).send({ data: { id } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  app.patch("/api/:slug/payroll/grids/:id", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = parseId((request.params as { id: string }).id);
    if (id == null) return sendApiError(reply, request, 400, "ValidationError");
    const parsed = gridPatchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      await patchGrid(request.tenant!.id, id, parsed.data, actorUserIdOrNull(request));
      return reply.send({ data: { ok: true } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  // ── Individual bog‘lash (oklad / formula) ───────────────────
  app.get("/api/:slug/payroll/assignments", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await listAssignments(request.tenant!.id, { role: q.role, search: q.search });
    return reply.send({ data });
  });

  app.put("/api/:slug/payroll/assignments", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = assignmentsBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const saved = await saveAssignments(request.tenant!.id, parsed.data.items, actorUserIdOrNull(request));
      return reply.send({ data: { saved } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  // ── Oylik hisob ─────────────────────────────────────────────
  app.get("/api/:slug/payroll/periods", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await listPeriods(request.tenant!.id);
    return reply.send({ data });
  });

  app.get("/api/:slug/payroll/calc", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = calcQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const [preview, saved] = await Promise.all([
      calculateMonth({
        tenantId: request.tenant!.id,
        month: parsed.data.month,
        actorUserId: actorUserIdOrNull(request),
        role: parsed.data.role,
        kpi_group_id: parsed.data.kpi_group_id,
        include_inactive: parsed.data.include_inactive,
        persist: false
      }),
      listEntries(request.tenant!.id, parsed.data.month, {
        role: parsed.data.role,
        user_id: undefined
      })
    ]);
    return reply.send({
      data: {
        month: preview.month,
        period: saved.period,
        preview: preview.result,
        rows: saved.rows
      }
    });
  });

  app.post("/api/:slug/payroll/calc", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = calcQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const out = await calculateMonth({
        tenantId: request.tenant!.id,
        month: parsed.data.month,
        actorUserId: actorUserIdOrNull(request),
        role: parsed.data.role,
        kpi_group_id: parsed.data.kpi_group_id,
        include_inactive: parsed.data.include_inactive,
        persist: true
      });
      const saved = await listEntries(request.tenant!.id, parsed.data.month, { role: parsed.data.role });
      return reply.send({
        data: { month: out.month, period: saved.period, totals: out.result.totals, rows: saved.rows }
      });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  app.get("/api/:slug/payroll/entries", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const month = monthSchema.safeParse((request.query as { month?: string }).month);
    if (!month.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(month.error));
    }
    const q = request.query as Record<string, string | undefined>;
    const data = await listEntries(request.tenant!.id, month.data, {
      role: q.role,
      user_id: parseId(q.user_id) ?? undefined
    });
    return reply.send({ data });
  });

  app.patch("/api/:slug/payroll/entries/:id", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = parseId((request.params as { id: string }).id);
    if (id == null) return sendApiError(reply, request, 400, "ValidationError");
    const parsed = entryPatchBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      await patchEntry(request.tenant!.id, id, parsed.data, actorUserIdOrNull(request));
      return reply.send({ data: { ok: true } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  app.post("/api/:slug/payroll/periods/:id/status", { preHandler: preApprove }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = parseId((request.params as { id: string }).id);
    if (id == null) return sendApiError(reply, request, 400, "ValidationError");
    const body = request.body as { status?: string };
    const status = body?.status;
    if (status !== "approved" && status !== "locked" && status !== "draft") {
      return sendApiError(reply, request, 400, "ValidationError", "BAD_STATUS");
    }
    try {
      await setPeriodStatus(request.tenant!.id, id, status, actorUserIdOrNull(request));
      const periods = await listPeriods(request.tenant!.id, { limit: 24 });
      return reply.send({ data: { ok: true, period: periods.find((p) => p.id === id) ?? null } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  // ── To‘lovlar ───────────────────────────────────────────────
  app.get("/api/:slug/payroll/payments", { preHandler: preRead }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = paymentsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const data = await listPayments(request.tenant!.id, parsed.data);
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/payments", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const parsed = paymentCreateBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    try {
      const id = await createPayment(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
      return reply.status(201).send({ data: { id } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });

  app.post("/api/:slug/payroll/payments/:id/void", { preHandler: preApprove }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = parseId((request.params as { id: string }).id);
    if (id == null) return sendApiError(reply, request, 400, "ValidationError");
    try {
      await voidPayment(request.tenant!.id, id, actorUserIdOrNull(request));
      return reply.send({ data: { ok: true } });
    } catch (e) {
      return mapPayrollError(e, reply, request);
    }
  });
}
