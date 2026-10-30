import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listSchemeMatches, previewPayrollScheme } from "./payroll.schemes.preview";
import {
  createPayrollScheme,
  deletePayrollScheme,
  deleteSchemeOverride,
  listPayrollSchemes,
  listSchemeOverrides,
  overrideBody,
  saveSchemeOverride,
  schemeBody,
  updatePayrollScheme,
  versionPayrollScheme,
  ymSchema
} from "./payroll.schemes.service";
import { parseYm, payrollCtx, perm, runPayroll, sendZod } from "./payroll.route-helpers";

const VIEW = ["staff.zarplaty.view"];
const UPDATE = ["staff.zarplaty.update"];
const CREATE = ["staff.zarplaty.create", ...UPDATE];

const previewBody = z.object({
  rules: schemeBody.shape.rules,
  user_id: z.number().int().positive(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12)
});

const idOf = (req: { params: unknown }) => Number((req.params as { id: string }).id);

export async function registerPayrollSchemeRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/schemes", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return reply.send({ data: await listPayrollSchemes(c.tenantId) });
  });

  app.get("/api/:slug/payroll/schemes/matches", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const ym = parseYm(req.query as Record<string, unknown>);
    if (!ym) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await listSchemeMatches(c.tenantId, ym.year, ym.month) });
  });

  app.post("/api/:slug/payroll/schemes/preview", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = previewBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await previewPayrollScheme(c.tenantId, p.data) }));
  });

  app.post("/api/:slug/payroll/schemes", perm(...CREATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = schemeBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.status(201).send({ data: await createPayrollScheme(c.tenantId, p.data, c.actorId) }));
  });

  app.put("/api/:slug/payroll/schemes/:id", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = schemeBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await updatePayrollScheme(c.tenantId, idOf(req), p.data, c.actorId) }));
  });

  app.post("/api/:slug/payroll/schemes/:id/version", perm(...CREATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = z.object({ valid_from: ymSchema }).safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () =>
      reply.status(201).send({ data: await versionPayrollScheme(c.tenantId, idOf(req), p.data.valid_from, c.actorId) })
    );
  });

  app.delete("/api/:slug/payroll/schemes/:id", perm("staff.zarplaty.delete"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return runPayroll(reply, req, async () => {
      await deletePayrollScheme(c.tenantId, idOf(req), c.actorId);
      return reply.send({ ok: true });
    });
  });

  app.get("/api/:slug/payroll/scheme-overrides", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const uid = Number((req.query as { user_id?: string }).user_id);
    return reply.send({ data: await listSchemeOverrides(c.tenantId, Number.isInteger(uid) && uid > 0 ? uid : null) });
  });

  app.post("/api/:slug/payroll/scheme-overrides", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = overrideBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.status(201).send({ data: await saveSchemeOverride(c.tenantId, null, p.data, c.actorId) }));
  });

  app.put("/api/:slug/payroll/scheme-overrides/:id", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = overrideBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await saveSchemeOverride(c.tenantId, idOf(req), p.data, c.actorId) }));
  });

  app.delete("/api/:slug/payroll/scheme-overrides/:id", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return runPayroll(reply, req, async () => {
      await deleteSchemeOverride(c.tenantId, idOf(req), c.actorId);
      return reply.send({ ok: true });
    });
  });
}
