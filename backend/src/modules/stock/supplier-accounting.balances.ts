import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getCashDeskAvailableCash } from "./supplier-payment-cash.service";

import { decimalStr } from "./supplier-accounting.shared";

export async function listSupplierBalancesSummary(tenantId: number, search?: string) {
  const where: Prisma.SupplierWhereInput = { tenant_id: tenantId, is_active: true };
  const q = search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } }
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      opening_balance: true,
      opening_balance_note: true
    }
  });

  const ids = suppliers.map((s) => s.id);
  if (ids.length === 0) return [];

  const [receiptGroups, payGroups] = await Promise.all([
    prisma.goodsReceipt.groupBy({
      by: ["supplier_id"],
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        status: "posted",
        supplier_id: { in: ids }
      },
      _sum: { total_sum: true }
    }),
    prisma.supplierPayment.groupBy({
      by: ["supplier_id"],
      where: { tenant_id: tenantId, supplier_id: { in: ids }, reversed_at: null },
      _sum: { amount: true }
    })
  ]);

  const mapR = new Map<number, Decimal>();
  for (const g of receiptGroups) {
    if (g.supplier_id != null) mapR.set(g.supplier_id, g._sum?.total_sum ?? new Decimal(0));
  }
  const mapP = new Map<number, Decimal>();
  for (const g of payGroups) {
    mapP.set(g.supplier_id, g._sum?.amount ?? new Decimal(0));
  }

  return suppliers.map((s) => {
    const opening = new Decimal(s.opening_balance ?? 0);
    const purchases = mapR.get(s.id) ?? new Decimal(0);
    const payments = mapP.get(s.id) ?? new Decimal(0);
    const balance = opening.add(purchases).sub(payments);
    return {
      id: s.id,
      name: s.name,
      code: s.code,
      opening_balance: decimalStr(opening),
      purchases_total: decimalStr(purchases),
      payments_total: decimalStr(payments),
      balance: decimalStr(balance),
      opening_balance_note: s.opening_balance_note
    };
  });
}
