import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createPayrollFormula,
  deletePayrollFormula,
  listFormulaVariables,
  listPayrollFormulas,
  previewPayrollFormula,
  updatePayrollFormula,
  validatePayrollFormulaText
} from "./payroll.formulas.service";
import { payrollCtx, perm, runPayroll, sendZod } from "./payroll.route-helpers";

const VIEW = ["staff.zarplaty.view"];
const UPDATE = ["staff.zarplaty.update"];

const formulaBody = z.object({
  name: z.string().min(1).max(200).optional(),
  scope: z.enum(["bonus", "allowance", "salary", "common"]).optional(),
  text: z.string().max(4000).optional(),
  role: z.string().max(64).nullable().optional(),
  target_item_id: z.number().int().positive().nullable().optional(),
  priority: z.number().int().min(0).max(100000).optional(),
  is_active: z.boolean().optional()
});

const previewBody = z.object({
  text: z.string().min(1).max(4000),
  user_id: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  kpi_group_id: z.number().int().positive().nullable().optional()
});

export async function registerPayrollFormulaRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/formulas", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return reply.send({ data: await listPayrollFormulas(c.tenantId) });
  });

  app.get("/api/:slug/payroll/formulas/variables", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return reply.send({ data: await listFormulaVariables(c.tenantId) });
  });

  app.post("/api/:slug/payroll/formulas/validate", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const text = String((req.body as { text?: unknown } | null)?.text ?? "");
    return reply.send({ data: await validatePayrollFormulaText(c.tenantId, text) });
  });

  app.post("/api/:slug/payroll/formulas/preview", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = previewBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await previewPayrollFormula(c.tenantId, p.data) }));
  });

  app.post("/api/:slug/payroll/formulas", perm("staff.zarplaty.create", ...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = formulaBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () =>
      reply.status(201).send({ data: await createPayrollFormula(c.tenantId, p.data, c.actorId) })
    );
  });

  app.patch("/api/:slug/payroll/formulas/:id", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    const p = formulaBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await updatePayrollFormula(c.tenantId, id, p.data, c.actorId) }));
  });

  app.delete("/api/:slug/payroll/formulas/:id", perm("staff.zarplaty.delete"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    return runPayroll(reply, req, async () => {
      await deletePayrollFormula(c.tenantId, id, c.actorId);
      return reply.send({ ok: true });
    });
  });
}
