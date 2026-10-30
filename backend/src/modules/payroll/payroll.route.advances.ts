import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { approveAdvances, listAdvanceApprovals, rejectAdvances } from "./payroll.advance-approvals";
import { deleteAdvanceLimit, listAdvanceLimits, upsertAdvanceLimit } from "./payroll.advance-limits";
import {
  cancelAdvances,
  createAdvance,
  deleteAdvance,
  importAdvances,
  listAdvanceEmployees,
  listManagerAdvances,
  sendAdvances,
  updateAdvance
} from "./payroll.advances.service";
import type { AdvanceActor } from "./payroll.advances.shared";
import { csvList, parseYm, payrollCtx, perm, runPayroll, sendZod, type PayrollCtx } from "./payroll.route-helpers";

const ym = { year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) };
const ids = z.object({ ids: z.array(z.number().int().positive()).min(1).max(5000) });
const limitBody = z.object({
  scope: z.enum(["global", "role", "user"]),
  role: z.string().trim().max(64).nullable().optional(),
  user_id: z.number().int().positive().nullable().optional(),
  max_amount: z.number().min(0),
  is_exception: z.boolean().optional(),
  comment: z.string().max(500).nullable().optional()
});
const createBody = z.object({
  ...ym,
  user_id: z.number().int().positive(),
  amount: z.number().positive(),
  comment: z.string().max(500).nullable().optional()
});
const patchBody = z.object({
  year: ym.year.optional(),
  month: ym.month.optional(),
  amount: z.number().positive().optional(),
  comment: z.string().max(500).nullable().optional()
});
const importBody = z.object({
  ...ym,
  apply: z.boolean().default(false),
  rows: z
    .array(z.object({ code: z.string().trim().min(1).max(64), amount: z.number(), comment: z.string().max(500).nullable().optional() }))
    .min(1)
    .max(5000)
});
const rejectBody = ids.extend({ reason: z.string().trim().min(1).max(500) });

const actorOf = (c: PayrollCtx): AdvanceActor => ({ userId: c.actorId ?? c.userId, role: c.role });
const idParam = (req: FastifyRequest) => Number((req.params as { id: string }).id);
const numList = (v: unknown) => csvList(v).map(Number).filter((x) => Number.isInteger(x) && x > 0);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function withBody<S extends z.ZodTypeAny>(
  schema: S,
  fn: (c: PayrollCtx, body: z.infer<S>, req: FastifyRequest, reply: FastifyReply) => Promise<unknown>
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = schema.safeParse(req.body ?? {});
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, () => fn(c, p.data, req, reply));
  };
}

export async function registerPayrollAdvanceRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/advance-limits", perm("staff.avans_limity.view", "staff.avans.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return reply.send({ data: await listAdvanceLimits(c.tenantId) });
  });
  const saveLimit = withBody(limitBody, async (c, b, _req, reply) =>
    reply.send({ data: await upsertAdvanceLimit(c.tenantId, b, c.actorId) })
  );
  app.post("/api/:slug/payroll/advance-limits", perm("staff.avans_limity.update"), saveLimit);
  app.put("/api/:slug/payroll/advance-limits", perm("staff.avans_limity.update"), saveLimit);
  app.delete("/api/:slug/payroll/advance-limits/:id", perm("staff.avans_limity.update"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return runPayroll(reply, req, async () => {
      await deleteAdvanceLimit(c.tenantId, idParam(req), c.actorId);
      return reply.send({ ok: true });
    });
  });

  app.get("/api/:slug/payroll/advances", perm("staff.avans.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as Record<string, unknown>;
    const p = parseYm(q);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    const data = await listManagerAdvances(c.tenantId, actorOf(c), {
      ...p,
      statuses: csvList(q.status),
      q: str(q.q),
      user_ids: numList(q.user_ids)
    });
    return reply.send({ data });
  });
  app.get("/api/:slug/payroll/advances/employees", perm("staff.avans.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as Record<string, unknown>;
    const p = parseYm(q);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await listAdvanceEmployees(c.tenantId, actorOf(c), { ...p, q: str(q.q) }) });
  });
  app.post(
    "/api/:slug/payroll/advances",
    perm("staff.avans.create"),
    withBody(createBody, async (c, b, _req, reply) => reply.status(201).send({ data: await createAdvance(c.tenantId, actorOf(c), b) }))
  );
  app.patch(
    "/api/:slug/payroll/advances/:id",
    perm("staff.avans.update"),
    withBody(patchBody, async (c, b, req, reply) => reply.send({ data: await updateAdvance(c.tenantId, actorOf(c), idParam(req), b) }))
  );
  app.delete("/api/:slug/payroll/advances/:id", perm("staff.avans.delete"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return runPayroll(reply, req, async () => {
      await deleteAdvance(c.tenantId, actorOf(c), idParam(req));
      return reply.send({ ok: true });
    });
  });
  app.post(
    "/api/:slug/payroll/advances/send",
    perm("staff.avans.status"),
    withBody(ids, async (c, b, _req, reply) => reply.send({ data: await sendAdvances(c.tenantId, actorOf(c), b.ids) }))
  );
  app.post(
    "/api/:slug/payroll/advances/cancel",
    perm("staff.avans.status"),
    withBody(ids, async (c, b, _req, reply) => reply.send({ data: await cancelAdvances(c.tenantId, actorOf(c), b.ids) }))
  );
  app.post(
    "/api/:slug/payroll/advances/import",
    perm("staff.avans.import"),
    withBody(importBody, async (c, b, _req, reply) => reply.send({ data: await importAdvances(c.tenantId, actorOf(c), b) }))
  );

  app.get("/api/:slug/payroll/advance-approvals", perm("finance.avans.view", "finance.avans.approve"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as Record<string, unknown>;
    const p = parseYm(q);
    const date = (v: unknown) => {
      const d = str(v) ? new Date(String(v)) : null;
      return d && !Number.isNaN(d.getTime()) ? d : undefined;
    };
    const data = await listAdvanceApprovals(c.tenantId, {
      ...(p ?? {}),
      statuses: csvList(q.status),
      branch: str(q.branch),
      role: str(q.role),
      sent_by: numList(q.sent_by)[0],
      date_from: date(q.date_from),
      date_to: date(q.date_to),
      q: str(q.q)
    });
    return reply.send({ data });
  });
  app.post(
    "/api/:slug/payroll/advance-approvals/approve",
    perm("finance.avans.approve"),
    withBody(ids, async (c, b, _req, reply) => reply.send({ data: await approveAdvances(c.tenantId, actorOf(c), b.ids) }))
  );
  app.post(
    "/api/:slug/payroll/advance-approvals/reject",
    perm("finance.avans.approve"),
    withBody(rejectBody, async (c, b, _req, reply) =>
      reply.send({ data: await rejectAdvances(c.tenantId, actorOf(c), b.ids, b.reason) })
    )
  );
  app.post(
    "/api/:slug/payroll/advance-approvals/cancel",
    perm("finance.avans.approve"),
    withBody(ids, async (c, b, _req, reply) =>
      reply.send({ data: await cancelAdvances(c.tenantId, actorOf(c), b.ids, { skipScope: true }) })
    )
  );
}
