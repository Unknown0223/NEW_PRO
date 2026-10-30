import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPayrollSettings, updatePayrollSettings } from "./payroll.settings";
import { createPayrollItem, deletePayrollItem, listPayrollItems, updatePayrollItem } from "./payroll.items.service";
import {
  importEmployeeConfigs,
  listEmployeeConfigs,
  listRoleConfigs,
  upsertEmployeeConfig,
  upsertRoleConfig
} from "./payroll.configs.service";
import { copyGrids, overlayEmployeeGrids, overlayRoleGrids, saveRoleGrid, saveUserGrid } from "./payroll.grid-month";
import { payrollKpiGrid, savePayrollKpiAmounts } from "./payroll.grid-kpi";
import { prisma } from "../../config/database";
import { mapPayrollError, payrollCtx, perm, sendZod } from "./payroll.route-helpers";

const VIEW = ["staff.zarplaty.view"];
const UPDATE = ["staff.zarplaty.update"];

const settingsBody = z.object({
  enabled: z.boolean().optional(),
  parallel_run: z.boolean().optional(),
  salary_queue_enabled: z.boolean().optional()
});

const itemBody = z.object({
  name: z.string().min(1).max(160).optional(),
  code: z.string().max(64).nullable().optional(),
  type: z.enum(["allowance", "deduction"]).optional(),
  calc_type: z.enum(["formula", "manual"]).optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  color: z.string().max(16).nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional()
});

const roleCfgBody = z.object({
  base_amount: z.number().min(0).max(1e13).optional(),
  currency: z.string().max(8).optional(),
  allowance_item_ids: z.array(z.number().int().positive()).max(200).optional(),
  deduction_item_ids: z.array(z.number().int().positive()).max(200).optional(),
  comment: z.string().max(500).nullable().optional(),
  item_amounts: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(1e13).nullable()).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional()
});

const empCfgBody = z.object({
  base_amount: z.number().min(0).max(1e13).nullable().optional(),
  cash_desk_id: z.number().int().positive().nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  item_amounts: z.record(z.string().regex(/^\d+$/), z.number().min(0).max(1e13).nullable()).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional()
});

const empImportBody = z.object({
  apply: z.boolean().default(false),
  rows: z
    .array(
      z.object({
        code: z.string().min(1).max(64),
        base_amount: z.number().nullable().optional(),
        cash_desk: z.string().max(160).nullable().optional(),
        item_amounts: z.record(z.string().regex(/^\d+$/), z.number()).optional()
      })
    )
    .min(1)
    .max(5000)
});

export async function registerPayrollCatalogRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/settings", perm(...VIEW, "staff.avans.view", "cash.vydacha_zarplaty.view"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    return reply.send({ data: await getPayrollSettings(c.tenantId) });
  });

  app.patch("/api/:slug/payroll/settings", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = settingsBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return reply.send({ data: await updatePayrollSettings(c.tenantId, p.data, c.actorId) });
  });

  app.get("/api/:slug/payroll/items", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as { type?: string; active?: string };
    const data = await listPayrollItems(c.tenantId, {
      type: q.type === "allowance" || q.type === "deduction" ? q.type : undefined,
      activeOnly: q.active === "1" || q.active === "true"
    });
    return reply.send({ data });
  });

  app.post("/api/:slug/payroll/items", perm("staff.zarplaty.create", ...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = itemBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    try {
      return reply.status(201).send({ data: await createPayrollItem(c.tenantId, p.data, c.actorId) });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });

  app.patch("/api/:slug/payroll/items/:id", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    const p = itemBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    try {
      return reply.send({ data: await updatePayrollItem(c.tenantId, id, p.data, c.actorId) });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });

  app.delete("/api/:slug/payroll/items/:id", perm("staff.zarplaty.delete"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    try {
      await deletePayrollItem(c.tenantId, id, c.actorId);
      return reply.send({ ok: true });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });

  app.get("/api/:slug/payroll/role-configs", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as { year?: string; month?: string };
    let data = await listRoleConfigs(c.tenantId);
    const year = Number(q.year);
    const month = Number(q.month);
    if (year && month) data = await overlayRoleGrids(c.tenantId, year, month, data);
    return reply.send({ data });
  });

  app.put("/api/:slug/payroll/role-configs/:role", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const role = decodeURIComponent((req.params as { role: string }).role);
    const p = roleCfgBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    try {
      const { year, month, ...rest } = p.data;
      if (year && month) await saveRoleGrid(c.tenantId, role, year, month, { base_amount: rest.base_amount, item_amounts: rest.item_amounts });
      const live = { ...rest };
      if (year && month) {
        delete live.base_amount;
        delete live.item_amounts;
      }
      if (!year || !month || live.allowance_item_ids || live.deduction_item_ids || live.comment !== undefined || live.currency) {
        await upsertRoleConfig(c.tenantId, role, live, c.actorId);
      }
      return reply.send({ ok: true });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });

  app.get("/api/:slug/payroll/employee-configs", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as { role?: string; q?: string; include_inactive?: string; year?: string; month?: string };
    let data = await listEmployeeConfigs(c.tenantId, {
      role: q.role?.trim() || undefined,
      q: q.q,
      includeInactive: q.include_inactive === "1"
    });
    const year = Number(q.year);
    const month = Number(q.month);
    if (year && month) data = await overlayEmployeeGrids(c.tenantId, year, month, data);
    return reply.send({ data });
  });

  app.put("/api/:slug/payroll/employee-configs/:userId", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const userId = Number((req.params as { userId: string }).userId);
    const p = empCfgBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    try {
      const { year, month, ...rest } = p.data;
      if (year && month) {
        const u = await prisma.user.findFirst({ where: { id: userId, tenant_id: c.tenantId }, select: { role: true } });
        await saveUserGrid(c.tenantId, userId, u?.role ?? "", year, month, { base_amount: rest.base_amount, item_amounts: rest.item_amounts });
      }
      const live = { ...rest };
      if (year && month) {
        delete live.base_amount;
        delete live.item_amounts;
      }
      if (!year || !month || live.cash_desk_id !== undefined || live.comment !== undefined) {
        await upsertEmployeeConfig(c.tenantId, userId, live, c.actorId);
      }
      return reply.send({ ok: true });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/payroll/employee-configs/import", perm(...UPDATE, "staff.zarplaty.import"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = empImportBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return reply.send({ data: await importEmployeeConfigs(c.tenantId, p.data.rows, p.data.apply, c.actorId) });
  });

  app.get("/api/:slug/payroll/kpi-grid", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const q = req.query as { year?: string; month?: string };
    const year = Number(q.year);
    const month = Number(q.month);
    if (!year || !month) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await payrollKpiGrid(c.tenantId, year, month) });
  });

  app.put("/api/:slug/payroll/kpi-grid", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = z.object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      rows: z.array(z.object({
        user_id: z.number().int().positive(),
        amounts: z.record(z.string(), z.number().min(0).max(1e13).nullable())
      })).max(2000)
    }).safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    try {
      return reply.send({ data: await savePayrollKpiAmounts(c.tenantId, p.data.year, p.data.month, p.data.rows) });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });

  app.post("/api/:slug/payroll/grids/copy", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = z.object({
      from: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }),
      to: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) })
    }).safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    try {
      return reply.send({ data: await copyGrids(c.tenantId, p.data.from, p.data.to) });
    } catch (e) {
      if (mapPayrollError(reply, req, e)) return;
      throw e;
    }
  });
}
