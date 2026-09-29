import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assignBonusFormula, deleteBonusAssignment, listBonusKpi } from "./payroll.bonus.service";
import { csvList, parseYm, payrollCtx, perm, runPayroll, sendZod } from "./payroll.route-helpers";

const assignBody = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  user_ids: z.array(z.number().int().positive()).min(1).max(5000),
  kpi_group_id: z.number().int().min(0),
  trade_direction_id: z.number().int().min(0).optional(),
  formula_id: z.number().int().positive(),
  target_item_id: z.number().int().positive().nullable().optional()
});

const posInt = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

export async function registerPayrollBonusRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/bonus-kpi", perm("staff.zarplaty.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as Record<string, unknown>;
    const p = parseYm(q);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    const data = await listBonusKpi(c.tenantId, {
      ...p,
      role: typeof q.role === "string" && q.role.trim() ? q.role.trim() : undefined,
      trade_direction_id: posInt(q.trade_direction_id),
      kpi_group_id: posInt(q.kpi_group_id),
      user_ids: csvList(q.user_ids).map(Number).filter((x) => Number.isInteger(x) && x > 0),
      q: typeof q.q === "string" ? q.q : undefined
    });
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/bonus-assignments", perm("staff.zarplaty.assign"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = assignBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await assignBonusFormula(c.tenantId, p.data, c.actorId) }));
  });

  app.delete("/api/:slug/payroll/bonus-assignments/:id", perm("staff.zarplaty.assign"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    return runPayroll(reply, req, async () => {
      await deleteBonusAssignment(c.tenantId, id, c.actorId);
      return reply.send({ ok: true });
    });
  });
}
