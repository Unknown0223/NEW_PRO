import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { CashFlowReportPayload } from "./cash-flow.types";

export async function resolveCashDeskIdForReport(
  tenantId: number,
  raw: string | undefined | null
): Promise<number> {
  const s = (raw ?? "").trim();
  if (!s) throw new Error("BAD_CASH_DESK");
  const asNum = Number.parseInt(s, 10);
  if (Number.isFinite(asNum) && asNum > 0) {
    const d = await prisma.cashDesk.findFirst({ where: { id: asNum, tenant_id: tenantId } });
    if (!d) throw new Error("BAD_CASH_DESK");
    return d.id;
  }
  const normToken = (x: string) =>
    x
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
  const target = normToken(s);
  const compact = (x: string) => normToken(x).replace(/_/g, "");
  const desks = await prisma.cashDesk.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, name: true, code: true }
  });
  for (const d of desks) {
    const c = d.code?.trim();
    if (c && normToken(c) === target) return d.id;
  }
  for (const d of desks) {
    if (normToken(d.name) === target) return d.id;
  }
  const t2 = compact(s);
  for (const d of desks) {
    if (compact(d.name) === t2) return d.id;
    if (d.code && compact(d.code) === t2) return d.id;
  }
  throw new Error("BAD_CASH_DESK");
}
