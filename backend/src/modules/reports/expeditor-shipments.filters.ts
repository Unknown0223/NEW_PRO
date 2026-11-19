import { prisma } from "../../config/database";
import { ORDER_STATUSES } from "../orders/order-status";
import type { ReportActor } from "./client-sales-4-report.service";
import { resolveFilterOptionsScope, staffWhereForFilterOptions } from "../access/access-filter-options-scope";
import { ORDER_STATUS_LABEL_RU } from "./expeditor-returns.helpers";

export async function getExpeditorShipmentsFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);

  const [expeditors, categories, products] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, "expeditor"),
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }),
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
      take: 3000
    })
  ]);

  return {
    date_types: [
      { id: "order_date", label: "Дата заявки" },
      { id: "shipped_date", label: "Дата отгрузки" },
      { id: "delivered_date", label: "Дата доставки" }
    ],
    statuses: ORDER_STATUSES.map((s) => ({ id: s, label: ORDER_STATUS_LABEL_RU[s] ?? s })),
    expeditors: expeditors.map((e) => ({ id: e.id, name: e.name, code: e.code ?? "" })),
    categories,
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))
  };
}
