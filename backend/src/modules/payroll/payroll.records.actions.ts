import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { withTransaction } from "../../lib/db-context";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { markPayrollDirty } from "./payroll.dirty";
import { recalcPayrollRecord } from "./payroll.recalc";
import { ensurePayrollPeriod } from "./payroll.recalc-month";
import { notifyUsers } from "./payroll.notify";
import { PayrollError } from "./payroll.route-helpers";

const ymKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

async function audit(tenantId: number, actorId: number | null, entityId: number | string, action: string, payload: unknown) {
  await appendTenantAuditEvent({ tenantId, actorUserId: actorId, entityType: AuditEntityType.payroll, entityId, action, payload });
}

async function periodClosed(tenantId: number, year: number, month: number) {
  const p = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    select: { status: true }
  });
  return p?.status === "closed";
}

async function loadEditable(tenantId: number, recordId: number) {
  const r = await prisma.payrollRecord.findFirst({ where: { id: recordId, tenant_id: tenantId } });
  if (!r) throw new PayrollError("NOT_FOUND");
  if (await periodClosed(tenantId, r.year, r.month)) throw new PayrollError("PERIOD_CLOSED");
  if (r.status === "confirmed") throw new PayrollError("RECORD_FROZEN");
  return r;
}

/** Qo'lda summa (`amount=null` — «Сбросить к формуле» / qatorni o'chirish). */
export async function setPayrollRecordLine(
  tenantId: number,
  recordId: number,
  input: { item_id: number; amount: number | null; note?: string | null },
  actorId: number | null
) {
  const r = await loadEditable(tenantId, recordId);
  const item = await prisma.payrollItem.findFirst({ where: { id: input.item_id, tenant_id: tenantId } });
  if (!item) throw new PayrollError("BAD_ITEM");
  if (item.system_key) throw new PayrollError("SYSTEM_ITEM");
  const key = { record_id_item_id_corr_key: { record_id: r.id, item_id: item.id, corr_key: "" } };
  const prev = await prisma.payrollRecordLine.findUnique({ where: key });
  if (input.amount == null) {
    if (prev) {
      if (prev.source === "manual") await prisma.payrollRecordLine.delete({ where: key });
      else await prisma.payrollRecordLine.update({ where: key, data: { is_manual_override: false } });
    }
  } else {
    if (!Number.isFinite(input.amount) || Math.abs(input.amount) > 1e13) throw new PayrollError("BAD_AMOUNT");
    const computed = prev != null && prev.source !== "manual";
    await prisma.payrollRecordLine.upsert({
      where: key,
      create: { record_id: r.id, item_id: item.id, corr_key: "", amount: input.amount, source: "manual", note: input.note ?? null },
      update: { amount: input.amount, is_manual_override: computed, note: input.note ?? prev?.note ?? null }
    });
  }
  await audit(tenantId, actorId, r.id, "payroll.record.line", {
    user_id: r.user_id,
    month: ymKey(r.year, r.month),
    item: item.name,
    before: prev ? Number(prev.amount) : null,
    after: input.amount
  });
  await recalcPayrollRecord(tenantId, r.user_id, r.year, r.month, { trigger: "manual_line", force: true });
}

type StatusAction = "submit" | "confirm" | "reject" | "reopen";

const FROM: Record<StatusAction, string[]> = {
  submit: ["draft", "rejected"],
  confirm: ["draft", "pending", "rejected"],
  reject: ["pending"],
  reopen: ["confirmed"]
};

export async function changePayrollRecordStatus(
  tenantId: number,
  ids: number[],
  action: StatusAction,
  actorId: number | null,
  reason?: string | null
): Promise<{ changed: number; skipped: Array<{ id: number; reason: string }> }> {
  if (action === "reject" && !reason?.trim()) throw new PayrollError("REASON_REQUIRED");
  const records = await prisma.payrollRecord.findMany({ where: { tenant_id: tenantId, id: { in: ids } } });
  const skipped: Array<{ id: number; reason: string }> = [];
  let changed = 0;
  for (const r of records) {
    if (!FROM[action].includes(r.status)) {
      skipped.push({ id: r.id, reason: `status:${r.status}` });
      continue;
    }
    if (await periodClosed(tenantId, r.year, r.month)) {
      skipped.push({ id: r.id, reason: "period_closed" });
      continue;
    }
    if (action === "confirm") {
      if (r.dirty_at || r.calc_error) {
        await recalcPayrollRecord(tenantId, r.user_id, r.year, r.month, { trigger: "confirm", force: true });
      }
      const fresh = await prisma.payrollRecord.findUniqueOrThrow({ where: { id: r.id }, include: { lines: true } });
      if (fresh.calc_error) {
        skipped.push({ id: r.id, reason: "calc_error" });
        continue;
      }
      await prisma.payrollRecord.update({
        where: { id: r.id },
        data: {
          status: "confirmed",
          confirmed_by: actorId,
          confirmed_at: new Date(),
          rejected_reason: null,
          frozen_inputs_hash: fresh.inputs_hash,
          frozen_snapshot: {
            gross: Number(fresh.gross),
            base_salary: Number(fresh.base_salary),
            allowances_total: Number(fresh.allowances_total),
            deductions_total: Number(fresh.deductions_total),
            lines: fresh.lines.map((l) => ({ item_id: l.item_id, corr_key: l.corr_key, amount: Number(l.amount) })),
            team: (fresh.calc_snapshot as { kpi?: { team_total?: unknown } })?.kpi?.team_total ?? null
          } as Prisma.InputJsonValue
        }
      });
    } else if (action === "reopen") {
      const corrKey = ymKey(r.year, r.month);
      const later = await prisma.payrollRecordLine.findMany({
        where: { corr_key: corrKey, record: { tenant_id: tenantId, user_id: r.user_id } },
        select: { id: true, record: { select: { id: true, year: true, month: true, status: true } } }
      });
      let blocked = false;
      for (const l of later) {
        if (l.record.status === "confirmed" || (await periodClosed(tenantId, l.record.year, l.record.month))) blocked = true;
      }
      if (blocked) {
        skipped.push({ id: r.id, reason: "correction_frozen" });
        continue;
      }
      await withTransaction(async (tx) => {
        if (later.length) await tx.payrollRecordLine.deleteMany({ where: { id: { in: later.map((l) => l.id) } } });
        await tx.payrollRecord.update({
          where: { id: r.id },
          data: { status: "draft", confirmed_by: null, confirmed_at: null, frozen_inputs_hash: null, frozen_snapshot: Prisma.DbNull }
        });
      });
      for (const l of later) {
        void recalcPayrollRecord(tenantId, r.user_id, l.record.year, l.record.month, { trigger: "reopen", force: true });
      }
      await recalcPayrollRecord(tenantId, r.user_id, r.year, r.month, { trigger: "reopen", force: true });
    } else {
      await prisma.payrollRecord.update({
        where: { id: r.id },
        data: { status: action === "submit" ? "pending" : "rejected", rejected_reason: action === "reject" ? reason!.trim().slice(0, 500) : null }
      });
    }
    changed++;
    await audit(tenantId, actorId, r.id, `payroll.record.${action}`, { user_id: r.user_id, month: ymKey(r.year, r.month), reason });
    if (action === "confirm" || action === "reject") {
      const ym = `${String(r.month).padStart(2, "0")}.${r.year}`;
      await notifyUsers(tenantId, [r.user_id], {
        title: action === "confirm" ? `💵 Зарплата за ${ym} подтверждена` : `⚠️ Расчёт зарплаты за ${ym} отклонён`,
        body: action === "reject" ? reason?.trim().slice(0, 300) ?? null : null,
        href: "/users/advances"
      });
    }
  }
  return { changed, skipped };
}

async function patchLockedMonths(tenantId: number, month: string, lock: boolean) {
  await withTransaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ settings: Prisma.JsonValue }>>(
      Prisma.sql`SELECT settings FROM tenants WHERE id = ${tenantId} FOR UPDATE`
    );
    const root = (rows[0]?.settings ?? {}) as Record<string, unknown>;
    const ts = (root.timesheet && typeof root.timesheet === "object" ? root.timesheet : {}) as Record<string, unknown>;
    const cur = Array.isArray(ts.locked_months) ? (ts.locked_months as string[]) : [];
    const next = lock ? [...new Set([...cur, month])].sort() : cur.filter((m) => m !== month);
    await tx.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...root, timesheet: { ...ts, locked_months: next } } as Prisma.InputJsonValue }
    });
  });
}

/** Oyni yopish: hamma record tasdiqlangan bo'lishi kerak (yoki `confirm_all`). Tabel oyi qulflanadi. */
export async function closePayrollPeriod(
  tenantId: number,
  year: number,
  month: number,
  actorId: number | null,
  opts: { confirm_all?: boolean } = {}
) {
  await ensurePayrollPeriod(tenantId, year, month);
  const open = await prisma.payrollRecord.findMany({
    where: { tenant_id: tenantId, year, month, NOT: { status: "confirmed" } },
    select: { id: true }
  });
  if (open.length) {
    if (!opts.confirm_all) throw new PayrollError("HAS_UNCONFIRMED", { count: open.length });
    const res = await changePayrollRecordStatus(tenantId, open.map((o) => o.id), "confirm", actorId);
    if (res.skipped.length) throw new PayrollError("HAS_UNCONFIRMED", { count: res.skipped.length, skipped: res.skipped });
  }
  await prisma.payrollPeriod.update({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    data: { status: "closed", closed_by: actorId, closed_at: new Date() }
  });
  await patchLockedMonths(tenantId, ymKey(year, month), true);
  await audit(tenantId, actorId, ymKey(year, month), "payroll.period.close", { confirmed_now: open.length });
}

export async function reopenPayrollPeriod(tenantId: number, year: number, month: number, actorId: number | null, actorRole: string) {
  if (actorRole !== "admin") throw new PayrollError("ADMIN_ONLY");
  await ensurePayrollPeriod(tenantId, year, month);
  await prisma.payrollPeriod.update({
    where: { tenant_id_year_month: { tenant_id: tenantId, year, month } },
    data: { status: "open", closed_by: null, closed_at: null }
  });
  await patchLockedMonths(tenantId, ymKey(year, month), false);
  await audit(tenantId, actorId, ymKey(year, month), "payroll.period.reopen", {});
}

export type TransferInput = {
  from: { year: number; month: number };
  to: { year: number; month: number };
  item_ids?: number[];
  bonus?: boolean;
  roles?: string[];
  branches?: string[];
  user_ids?: number[];
};

/** «Перенос данных»: qo'lda qatorlar va bonus biriktirmalari manba oydan maqsad oyga. */
export async function transferPayrollData(tenantId: number, input: TransferInput, actorId: number | null) {
  if (await periodClosed(tenantId, input.to.year, input.to.month)) throw new PayrollError("PERIOD_CLOSED");
  const src = await prisma.payrollRecord.findMany({
    where: {
      tenant_id: tenantId,
      year: input.from.year,
      month: input.from.month,
      ...(input.roles?.length ? { role: { in: input.roles } } : {}),
      ...(input.branches?.length ? { branch: { in: input.branches } } : {}),
      ...(input.user_ids?.length ? { user_id: { in: input.user_ids } } : {})
    },
    include: { lines: { where: { source: "manual", corr_key: "" } } }
  });
  const userIds = src.map((s) => s.user_id);
  let lines = 0;
  let bonuses = 0;
  const skippedFrozen: number[] = [];
  for (const s of src) {
    const chosen = s.lines.filter((l) => !input.item_ids?.length || input.item_ids.includes(l.item_id));
    if (!chosen.length) continue;
    const target = await prisma.payrollRecord.upsert({
      where: { tenant_id_user_id_year_month: { tenant_id: tenantId, user_id: s.user_id, year: input.to.year, month: input.to.month } },
      create: { tenant_id: tenantId, user_id: s.user_id, year: input.to.year, month: input.to.month, role: s.role, branch: s.branch },
      update: {}
    });
    if (target.status === "confirmed") {
      skippedFrozen.push(s.user_id);
      continue;
    }
    for (const l of chosen) {
      await prisma.payrollRecordLine.upsert({
        where: { record_id_item_id_corr_key: { record_id: target.id, item_id: l.item_id, corr_key: "" } },
        create: { record_id: target.id, item_id: l.item_id, corr_key: "", amount: l.amount, source: "manual", note: l.note },
        update: { amount: l.amount, source: "manual", note: l.note }
      });
      lines++;
    }
  }
  if (input.bonus && userIds.length) {
    const assigns = await prisma.payrollBonusAssignment.findMany({
      where: { tenant_id: tenantId, year: input.from.year, month: input.from.month, user_id: { in: userIds } }
    });
    const formulaText = new Map(
      (await prisma.payrollFormula.findMany({ where: { tenant_id: tenantId }, select: { id: true, text: true } })).map((f) => [f.id, f.text])
    );
    for (const a of assigns) {
      const data = {
        formula_id: a.formula_id,
        formula_text_snapshot: formulaText.get(a.formula_id) ?? a.formula_text_snapshot,
        created_by: actorId
      };
      await prisma.payrollBonusAssignment.upsert({
        where: {
          payroll_bonus_assignments_uq: {
            tenant_id: tenantId,
            year: input.to.year,
            month: input.to.month,
            user_id: a.user_id,
            kpi_group_id: a.kpi_group_id,
            trade_direction_id: a.trade_direction_id,
            target_item_id: a.target_item_id
          }
        },
        create: {
          tenant_id: tenantId,
          year: input.to.year,
          month: input.to.month,
          user_id: a.user_id,
          kpi_group_id: a.kpi_group_id,
          trade_direction_id: a.trade_direction_id,
          target_item_id: a.target_item_id,
          ...data
        },
        update: data
      });
      bonuses++;
    }
  }
  await audit(tenantId, actorId, ymKey(input.to.year, input.to.month), "payroll.transfer", { ...input, lines, bonuses });
  if (userIds.length) await markPayrollDirty(tenantId, { userIds, year: input.to.year, month: input.to.month }, "transfer");
  return { users: userIds.length, lines, bonuses, skipped_frozen: skippedFrozen };
}
