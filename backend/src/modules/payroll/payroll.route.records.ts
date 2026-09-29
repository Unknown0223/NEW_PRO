import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { logger } from "../../config/logger";
import { exportPayrollRecords, getPayrollRecordDetail, listPayrollRecords, type RecordsFilter } from "./payroll.records.list";
import {
  changePayrollRecordStatus,
  closePayrollPeriod,
  reopenPayrollPeriod,
  setPayrollRecordLine,
  transferPayrollData
} from "./payroll.records.actions";
import { recalcPayrollRecord } from "./payroll.recalc";
import { recalcPayrollMonth } from "./payroll.recalc-month";
import { csvList, parseYm, payrollCtx, perm, runPayroll, sendZod } from "./payroll.route-helpers";
import { prisma } from "../../config/database";

const VIEW = ["staff.zarplaty.view"];
const UPDATE = ["staff.zarplaty.update"];
const ym = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });

const lineBody = z.object({
  item_id: z.number().int().positive(),
  amount: z.number().nullable(),
  note: z.string().max(500).nullable().optional()
});
const idsBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(5000), reason: z.string().max(500).nullable().optional() });
const recalcBody = ym.extend({ user_ids: z.array(z.number().int().positive()).max(5000).optional(), force: z.boolean().optional() });
const transferBody = z.object({
  from: ym,
  to: ym,
  item_ids: z.array(z.number().int().positive()).max(500).optional(),
  bonus: z.boolean().optional(),
  roles: z.array(z.string().max(64)).max(50).optional(),
  branches: z.array(z.string().max(160)).max(200).optional(),
  user_ids: z.array(z.number().int().positive()).max(5000).optional()
});

function parseFilter(req: FastifyRequest): RecordsFilter | null {
  const q = req.query as Record<string, unknown>;
  const p = parseYm(q);
  if (!p) return null;
  return {
    ...p,
    roles: csvList(q.roles),
    branches: csvList(q.branches),
    statuses: csvList(q.statuses),
    q: typeof q.q === "string" ? q.q : undefined,
    userIds: csvList(q.user_ids).map(Number).filter((x) => Number.isInteger(x) && x > 0)
  };
}

function parseYmParam(raw: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  return m ? parseYm({ year: m[1], month: m[2] }) : null;
}

export async function registerPayrollRecordRoutes(app: FastifyInstance) {
  app.get("/api/:slug/payroll/records", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const f = parseFilter(req);
    if (!f) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await listPayrollRecords(c.tenantId, f) });
  });

  app.get("/api/:slug/payroll/records/filters", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = parseYm(req.query as Record<string, unknown>);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    const rows = await prisma.payrollRecord.findMany({
      where: { tenant_id: c.tenantId, year: p.year, month: p.month },
      select: { role: true, branch: true },
      distinct: ["role", "branch"]
    });
    const roles = [...new Set(rows.map((r) => r.role).filter((x): x is string => Boolean(x)))].sort();
    const branches = [...new Set(rows.map((r) => r.branch).filter((x): x is string => Boolean(x)))].sort();
    return reply.send({ data: { roles, branches } });
  });

  app.get("/api/:slug/payroll/records/:id", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    return runPayroll(reply, req, async () => reply.send({ data: await getPayrollRecordDetail(c.tenantId, id) }));
  });

  app.put("/api/:slug/payroll/records/:id/lines", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const id = Number((req.params as { id: string }).id);
    const p = lineBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => {
      await setPayrollRecordLine(c.tenantId, id, p.data, c.actorId);
      return reply.send({ data: await getPayrollRecordDetail(c.tenantId, id) });
    });
  });

  app.post("/api/:slug/payroll/records/recalc", perm(...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = recalcBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    const { year, month, user_ids, force } = p.data;
    if (user_ids?.length && user_ids.length <= 50) {
      const results = [];
      for (const uid of user_ids) {
        results.push({ user_id: uid, ...(await recalcPayrollRecord(c.tenantId, uid, year, month, { trigger: "manual", force: force ?? true })) });
      }
      return reply.send({ data: { mode: "sync", results } });
    }
    void recalcPayrollMonth(c.tenantId, year, month, { trigger: "manual", force: force ?? true, userIds: user_ids }).catch((e) =>
      logger.warn({ err: e, tenantId: c.tenantId }, "payroll manual month recalc failed")
    );
    return reply.status(202).send({ data: { mode: "async" } });
  });

  for (const action of ["submit", "confirm", "reject", "reopen"] as const) {
    const keys =
      action === "confirm" || action === "reject" ? ["staff.zarplaty.approve"] : ["staff.zarplaty.status", "staff.zarplaty.approve"];
    app.post(`/api/:slug/payroll/records/${action}`, perm(...keys), async (req, reply) => {
      const c = payrollCtx(req, reply);
      if (!c) return;
      const p = idsBody.safeParse(req.body);
      if (!p.success) return sendZod(reply, req, p.error);
      return runPayroll(reply, req, async () =>
        reply.send({ data: await changePayrollRecordStatus(c.tenantId, p.data.ids, action, c.actorId, p.data.reason) })
      );
    });
  }

  app.post("/api/:slug/payroll/records/transfer", perm("staff.zarplaty.copy", ...UPDATE), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = transferBody.safeParse(req.body);
    if (!p.success) return sendZod(reply, req, p.error);
    return runPayroll(reply, req, async () => reply.send({ data: await transferPayrollData(c.tenantId, p.data, c.actorId) }));
  });

  app.get("/api/:slug/payroll/export", perm("staff.zarplaty.copy", ...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const f = parseFilter(req);
    if (!f) return reply.status(400).send({ error: "BadMonth" });
    return reply.send({ data: await exportPayrollRecords(c.tenantId, f) });
  });

  app.get("/api/:slug/payroll/periods", perm(...VIEW), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const rows = await prisma.payrollPeriod.findMany({
      where: { tenant_id: c.tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 36
    });
    return reply.send({ data: rows });
  });

  app.post("/api/:slug/payroll/periods/:ym/close", perm("staff.zarplaty.approve"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = parseYmParam((req.params as { ym: string }).ym);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    const confirmAll = Boolean((req.body as { confirm_all?: boolean } | null)?.confirm_all);
    return runPayroll(reply, req, async () => {
      await closePayrollPeriod(c.tenantId, p.year, p.month, c.actorId, { confirm_all: confirmAll });
      return reply.send({ ok: true });
    });
  });

  app.post("/api/:slug/payroll/periods/:ym/reopen", perm("staff.zarplaty.approve"), async (req, reply) => {
    const c = payrollCtx(req, reply);
    if (!c) return;
    const p = parseYmParam((req.params as { ym: string }).ym);
    if (!p) return reply.status(400).send({ error: "BadMonth" });
    return runPayroll(reply, req, async () => {
      await reopenPayrollPeriod(c.tenantId, p.year, p.month, c.actorId, c.role);
      return reply.send({ ok: true });
    });
  });
}
