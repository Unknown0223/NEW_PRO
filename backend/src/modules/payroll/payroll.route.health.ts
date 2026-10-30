import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createCompareBatch, getLatestCompare, signOffCompare } from "./payroll.compare";
import { getPayrollHealth } from "./payroll.health";
import { parseYm, payrollCtx, perm, runPayroll, sendZod } from "./payroll.route-helpers";

const compareBody = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  rows: z
    .array(
      z.object({
        code: z.string().trim().min(1).max(64),
        name: z.string().max(200).nullable().optional(),
        columns: z.record(z.string().max(160), z.number()),
        total: z.number().nullable().optional()
      })
    )
    .min(1)
    .max(5000)
});
const signOffBody = z.object({ note: z.string().max(500).nullable().optional() });

export async function registerPayrollHealthRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/health", perm("staff.zarplaty.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = parseYm(req.query as Record<string, unknown>);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await getPayrollHealth(c.tenantId, p.year, p.month) });
  });

  app.get("/api/:slug/payroll/compare", perm("staff.zarplaty.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = parseYm(req.query as Record<string, unknown>);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await getLatestCompare(c.tenantId, p.year, p.month) });
  });

  app.post("/api/:slug/payroll/compare", perm("staff.zarplaty.import"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = compareBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return reply.send({ data: await createCompareBatch(c.tenantId, p.data.year, p.data.month, p.data.rows, c.actorId) });
  });

  app.post("/api/:slug/payroll/compare/:id/sign-off", perm("staff.zarplaty.import", "staff.zarplaty.approve"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = signOffBody.safeParse(req.body ?? {});
    if (!p.success) return sendZod(reply, req, p.error);
    const id = Number((req.params as { id: string }).id);
    return runPayroll(reply, req, async () => reply.send({ data: await signOffCompare(c.tenantId, id, p.data.note ?? null, c.actorId) }));
  });
}
