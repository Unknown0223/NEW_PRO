import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { validateFormula } from "./payroll.formula-engine";
import { knownVariableSet } from "./payroll.formula-vars";
import { markPayrollDirty, markPayrollDirtyForTenant } from "./payroll.dirty";
import { PayrollError } from "./payroll.route-helpers";
import { ymAdd } from "./payroll.scheme-select.pure";
import { parseSchemeRule, type SchemeRule } from "./payroll.scheme.types";

export const ymSchema = z
  .number()
  .int()
  .min(200001)
  .max(210012)
  .refine((v) => v % 100 >= 1 && v % 100 <= 12, "Неверный месяц");

const ruleInput = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_]{1,32}$/, "Код: латиница, цифры, _"),
  name: z.string().trim().min(1).max(160),
  kind: z.string(),
  item_id: z.number().int().positive().nullable().default(null),
  params: z.unknown()
});

export const schemeBody = z.object({
  name: z.string().trim().min(1).max(160),
  roles: z.array(z.string().trim().min(1).max(64)).min(1).max(20),
  branches: z.array(z.string().trim().min(1).max(120)).max(200).default([]),
  trade_direction_ids: z.array(z.number().int().positive()).max(100).default([]),
  positions: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
  valid_from: ymSchema,
  valid_to: ymSchema.nullable().default(null),
  is_active: z.boolean().default(true),
  note: z.string().max(500).nullable().default(null),
  rules: z.array(ruleInput).max(40)
});
export type SchemeBody = z.infer<typeof schemeBody>;

export const overrideBody = z.object({
  user_id: z.number().int().positive(),
  rule_code: z.string().trim().min(1).max(32),
  amount: z.number().min(-1e12).max(1e12),
  valid_from: ymSchema,
  valid_to: ymSchema.nullable().default(null),
  note: z.string().max(500).nullable().default(null)
});
export type OverrideBody = z.infer<typeof overrideBody>;

const fmtYm = (ym: number) => `${Math.floor(ym / 100)}-${String(ym % 100).padStart(2, "0")}`;

async function closedYms(tenantId: number): Promise<number[]> {
  const rows = await prisma.payrollPeriod.findMany({ where: { tenant_id: tenantId, status: "closed" }, select: { year: true, month: true } });
  return rows.map((r) => r.year * 100 + r.month).sort((a, b) => a - b);
}

/** Yopilgan oyni qamragan oraliq qulflangan: o'zgartirish faqat yangi versiya orqali. */
function lockedBy(closed: number[], from: number, to: number | null): number | null {
  const hit = closed.filter((c) => c >= from && (to == null || c <= to));
  return hit.length ? hit[hit.length - 1]! : null;
}

/** Qoidalarni tekshiradi; xato bo'lsa `SCHEME_INVALID` bilan ro'yxat. */
export async function validateRules(tenantId: number, rules: SchemeBody["rules"]): Promise<SchemeRule[]> {
  const items = await prisma.payrollItem.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true, system_key: true, is_active: true }
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  const known = knownVariableSet(items.map((i) => i.name));
  const errors: string[] = [];
  const out: SchemeRule[] = [];
  const codes = new Set<string>();
  for (const r of rules) {
    if (codes.has(r.code)) errors.push(`${r.name}: код «${r.code}» повторяется`);
    codes.add(r.code);
    const p = parseSchemeRule({ ...r, params: r.params ?? {} });
    if ("error" in p) {
      errors.push(p.error);
      continue;
    }
    if (p.item_id != null) {
      const it = byId.get(p.item_id);
      if (!it) errors.push(`${r.name}: статья не найдена`);
      else if (it.system_key) errors.push(`${r.name}: системную статью «${it.name}» нельзя назначить`);
    }
    if (p.kind === "formula") {
      const v = validateFormula(p.params.text, known);
      if (!v.ok) errors.push(`${r.name}: ${v.error}`);
    }
    out.push(p);
  }
  if (out.filter((r) => r.kind === "base").length > 1) errors.push("Оклад может быть только один");
  if (errors.length) throw new PayrollError("SCHEME_INVALID", { errors });
  return out;
}

const sameSet = <T>(a: T[], b: T[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function assertNoOverlap(tenantId: number, body: SchemeBody, selfId: number | null) {
  if (!body.is_active) return;
  const others = await prisma.payrollScheme.findMany({ where: { tenant_id: tenantId, is_active: true, NOT: selfId ? { id: selfId } : undefined } });
  const end = body.valid_to ?? 999999;
  const clash = others.find(
    (o) =>
      sameSet(o.roles, body.roles) &&
      sameSet(o.branches, body.branches) &&
      sameSet(o.trade_direction_ids, body.trade_direction_ids) &&
      sameSet(o.positions, body.positions) &&
      o.valid_from <= end &&
      (o.valid_to ?? 999999) >= body.valid_from
  );
  if (clash) throw new PayrollError("SCHEME_OVERLAP", { scheme_id: clash.id, name: clash.name });
}

const ruleRows = (rules: SchemeRule[]) =>
  rules.map((r, i) => ({ code: r.code, name: r.name, kind: r.kind, item_id: r.item_id, sort: i + 1, params: r.params as Prisma.InputJsonValue }));

export async function listPayrollSchemes(tenantId: number) {
  const [rows, closed, used] = await Promise.all([
    prisma.payrollScheme.findMany({
      where: { tenant_id: tenantId },
      include: { rules: { orderBy: [{ sort: "asc" }, { id: "asc" }] } },
      orderBy: [{ is_active: "desc" }, { name: "asc" }, { valid_from: "asc" }]
    }),
    closedYms(tenantId),
    prisma.payrollRecord.groupBy({ by: ["scheme_id"], where: { tenant_id: tenantId, scheme_id: { not: null } }, _count: { _all: true } })
  ]);
  const cnt = new Map(used.map((u) => [u.scheme_id, u._count._all]));
  return rows.map((s) => {
    const lock = lockedBy(closed, s.valid_from, s.valid_to);
    return { ...s, records: cnt.get(s.id) ?? 0, locked_by: lock ? fmtYm(lock) : null };
  });
}

async function audit(tenantId: number, actorId: number | null, id: number, action: string, payload: Record<string, unknown>) {
  await appendTenantAuditEvent({ tenantId, actorUserId: actorId, entityType: AuditEntityType.payroll, entityId: id, action, payload });
}

export async function createPayrollScheme(tenantId: number, body: SchemeBody, actorId: number | null) {
  if (body.valid_to != null && body.valid_to < body.valid_from) throw new PayrollError("BAD_MONTH");
  const lock = lockedBy(await closedYms(tenantId), body.valid_from, body.valid_to);
  if (lock) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
  const rules = await validateRules(tenantId, body.rules);
  await assertNoOverlap(tenantId, body, null);
  const { rules: _r, ...head } = body;
  const row = await prisma.payrollScheme.create({
    data: { ...head, tenant_id: tenantId, created_by: actorId, rules: { create: ruleRows(rules) } }
  });
  await audit(tenantId, actorId, row.id, "payroll.scheme.create", { name: row.name, valid_from: row.valid_from });
  void markPayrollDirtyForTenant(tenantId, "scheme");
  return row;
}

/**
 * Qulflangan sxemada faqat nom/izoh va tugash oyi (oxirgi yopilgan oydan keyin) o'zgaradi;
 * qoidalar/filtrlar uchun — yangi versiya.
 */
export async function updatePayrollScheme(tenantId: number, id: number, body: SchemeBody, actorId: number | null) {
  const prev = await prisma.payrollScheme.findFirst({ where: { id, tenant_id: tenantId }, include: { rules: { orderBy: { sort: "asc" } } } });
  if (!prev) throw new PayrollError("NOT_FOUND");
  if (body.valid_to != null && body.valid_to < body.valid_from) throw new PayrollError("BAD_MONTH");
  const closed = await closedYms(tenantId);
  const lock = lockedBy(closed, prev.valid_from, prev.valid_to);
  const rules = await validateRules(tenantId, body.rules);
  if (lock) {
    const coreSame =
      sameSet(prev.roles, body.roles) &&
      sameSet(prev.branches, body.branches) &&
      sameSet(prev.trade_direction_ids, body.trade_direction_ids) &&
      sameSet(prev.positions, body.positions) &&
      prev.valid_from === body.valid_from &&
      prev.is_active === body.is_active &&
      JSON.stringify(ruleRows(prev.rules.map((r) => parseSchemeRule(r) as SchemeRule))) === JSON.stringify(ruleRows(rules));
    const endOk = body.valid_to == null ? prev.valid_to == null : body.valid_to >= lock;
    if (!coreSame || !endOk) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
  }
  await assertNoOverlap(tenantId, body, id);
  const { rules: _r, ...head } = body;
  const row = await prisma.$transaction(async (tx) => {
    await tx.payrollSchemeRule.deleteMany({ where: { scheme_id: id } });
    return tx.payrollScheme.update({ where: { id }, data: { ...head, rules: { create: ruleRows(rules) } } });
  });
  await audit(tenantId, actorId, id, "payroll.scheme.update", { name: row.name, valid_from: row.valid_from, valid_to: row.valid_to });
  void markPayrollDirtyForTenant(tenantId, "scheme");
  return row;
}

/** Yangi versiya: eski versiya `from - 1` oyda tugaydi, qoidalar nusxalanadi. */
export async function versionPayrollScheme(tenantId: number, id: number, from: number, actorId: number | null) {
  const prev = await prisma.payrollScheme.findFirst({ where: { id, tenant_id: tenantId }, include: { rules: true } });
  if (!prev) throw new PayrollError("NOT_FOUND");
  if (from <= prev.valid_from || (prev.valid_to != null && from > prev.valid_to)) throw new PayrollError("BAD_MONTH");
  const lock = lockedBy(await closedYms(tenantId), from, prev.valid_to);
  if (lock) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
  const row = await prisma.$transaction(async (tx) => {
    await tx.payrollScheme.update({ where: { id }, data: { valid_to: ymAdd(from, -1) } });
    const { id: _id, created_at: _c, updated_at: _u, rules, ...head } = prev;
    return tx.payrollScheme.create({
      data: {
        ...head,
        valid_from: from,
        created_by: actorId,
        rules: { create: rules.map((r) => ({ code: r.code, name: r.name, kind: r.kind, item_id: r.item_id, sort: r.sort, params: r.params as Prisma.InputJsonValue })) }
      }
    });
  });
  await audit(tenantId, actorId, row.id, "payroll.scheme.version", { from_scheme: id, valid_from: from });
  void markPayrollDirtyForTenant(tenantId, "scheme");
  return row;
}

export async function deletePayrollScheme(tenantId: number, id: number, actorId: number | null) {
  const prev = await prisma.payrollScheme.findFirst({ where: { id, tenant_id: tenantId } });
  if (!prev) throw new PayrollError("NOT_FOUND");
  const lock = lockedBy(await closedYms(tenantId), prev.valid_from, prev.valid_to);
  if (lock) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
  await prisma.$transaction([
    prisma.payrollRecord.updateMany({ where: { tenant_id: tenantId, scheme_id: id }, data: { scheme_id: null } }),
    prisma.payrollScheme.delete({ where: { id } })
  ]);
  await audit(tenantId, actorId, id, "payroll.scheme.delete", { name: prev.name });
  void markPayrollDirtyForTenant(tenantId, "scheme");
}

export async function listSchemeOverrides(tenantId: number, userId: number | null) {
  const [rows, closed] = await Promise.all([
    prisma.payrollSchemeOverride.findMany({
      where: { tenant_id: tenantId, ...(userId ? { user_id: userId } : {}) },
      orderBy: [{ user_id: "asc" }, { rule_code: "asc" }, { valid_from: "asc" }]
    }),
    closedYms(tenantId)
  ]);
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: [...new Set(rows.map((r) => r.user_id))] } },
    select: { id: true, name: true, role: true }
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const lock = lockedBy(closed, r.valid_from, r.valid_to);
    return { ...r, amount: Number(r.amount), user_name: byId.get(r.user_id)?.name ?? null, locked_by: lock ? fmtYm(lock) : null };
  });
}

async function assertUser(tenantId: number, userId: number) {
  const u = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId }, select: { id: true } });
  if (!u) throw new PayrollError("BAD_USER");
}

export async function saveSchemeOverride(tenantId: number, id: number | null, body: OverrideBody, actorId: number | null) {
  if (body.valid_to != null && body.valid_to < body.valid_from) throw new PayrollError("BAD_MONTH");
  await assertUser(tenantId, body.user_id);
  const closed = await closedYms(tenantId);
  let row;
  if (id == null) {
    const lock = lockedBy(closed, body.valid_from, body.valid_to);
    if (lock) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
    row = await prisma.payrollSchemeOverride.create({ data: { ...body, tenant_id: tenantId, created_by: actorId } });
  } else {
    const prev = await prisma.payrollSchemeOverride.findFirst({ where: { id, tenant_id: tenantId } });
    if (!prev) throw new PayrollError("NOT_FOUND");
    const lock = lockedBy(closed, prev.valid_from, prev.valid_to);
    if (lock) {
      const coreSame =
        prev.user_id === body.user_id && prev.rule_code === body.rule_code && Number(prev.amount) === body.amount && prev.valid_from === body.valid_from;
      if (!coreSame || (body.valid_to != null && body.valid_to < lock)) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
    }
    row = await prisma.payrollSchemeOverride.update({ where: { id }, data: body });
  }
  await audit(tenantId, actorId, row.id, "payroll.scheme.override", { user_id: body.user_id, rule_code: body.rule_code, amount: body.amount });
  void markPayrollDirty(tenantId, { userIds: [body.user_id] }, "scheme_override");
  return row;
}

export async function deleteSchemeOverride(tenantId: number, id: number, actorId: number | null) {
  const prev = await prisma.payrollSchemeOverride.findFirst({ where: { id, tenant_id: tenantId } });
  if (!prev) throw new PayrollError("NOT_FOUND");
  const lock = lockedBy(await closedYms(tenantId), prev.valid_from, prev.valid_to);
  if (lock) throw new PayrollError("SCHEME_LOCKED", { closed: fmtYm(lock) });
  await prisma.payrollSchemeOverride.delete({ where: { id } });
  await audit(tenantId, actorId, id, "payroll.scheme.override.delete", { user_id: prev.user_id, rule_code: prev.rule_code });
  void markPayrollDirty(tenantId, { userIds: [prev.user_id] }, "scheme_override");
}
