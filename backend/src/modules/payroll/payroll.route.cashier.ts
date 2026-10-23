import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listCashierQueue, listPayouts, skipQueueAdvance } from "./payroll.cashier-queue";
import { payPayroll, reversePayout } from "./payroll.payouts";
import { payrollCtx, perm, runPayroll, sendZod } from "./payroll.route-helpers";

const payBody = z
  .object({
    kind: z.enum(["advance", "salary"]),
    advance_id: z.number().int().positive().optional(),
    record_id: z.number().int().positive().optional(),
    cash_desk_id: z.number().int().positive(),
    payment_method_ref: z.string().trim().max(64).nullable().optional(),
    currency: z.string().trim().max(8).nullable().optional(),
    amount: z.number().positive().nullable().optional(),
    comment: z.string().max(500).nullable().optional()
  })
  .refine((b) => (b.kind === "advance" ? b.advance_id != null : b.record_id != null), { message: "target id required" });
const reverseBody = z.object({ reason: z.string().trim().min(1).max(500) });

const posInt = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export async function registerPayrollCashierRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/cashier-queue", perm("cash.vydacha_zarplaty.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as Record<string, unknown>;
    const data = await listCashierQueue(
      c.tenantId,
      { userId: c.actorId ?? c.userId, role: c.role },
      { q: typeof q.q === "string" ? q.q : undefined, kind: typeof q.kind === "string" ? q.kind : undefined }
    );
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/cashier-queue/:id/skip", perm("cash.vydacha_zarplaty.create"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    return runPayroll(reply, req, async () => {
      await skipQueueAdvance(c.tenantId, { userId: c.actorId ?? c.userId, role: c.role }, id);
      return reply.send({ ok: true });
    });
  });

  app.get("/api/:slug/payroll/payouts", perm("cash.vydacha_zarplaty.view", "cash.vydacha_zarplaty.history", "staff.zarplaty.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as Record<string, unknown>;
    const data = await listPayouts(
      c.tenantId,
      { userId: c.actorId ?? c.userId, role: c.role },
      {
        year: posInt(q.year),
        month: posInt(q.month),
        user_id: posInt(q.user_id),
        cash_desk_id: posInt(q.cash_desk_id),
        kind: typeof q.kind === "string" && q.kind ? q.kind : undefined,
        limit: posInt(q.limit)
      }
    );
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/payouts", perm("cash.vydacha_zarplaty.create"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = payBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () =>
      reply.status(201).send({ data: await payPayroll(c.tenantId, { userId: c.actorId ?? c.userId, role: c.role }, p.data) })
    );
  });

  app.post("/api/:slug/payroll/payouts/:id/reverse", perm("cash.vydacha_zarplaty.void"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = reverseBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    const id = Number((req.params as { id: string }).id);
    return runPayroll(reply, req, async () => {
      await reversePayout(c.tenantId, { userId: c.actorId ?? c.userId, role: c.role }, id, p.data.reason);
      return reply.send({ ok: true });
    });
  });
}
