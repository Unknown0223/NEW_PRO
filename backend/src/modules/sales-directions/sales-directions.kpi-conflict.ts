import { prisma } from "../../config/database";

export class KpiProductConflictError extends Error {
  detail: string;
  constructor(detail: string) {
    super("KPI_PRODUCT_CONFLICT");
    this.detail = detail;
  }
}

type Hit = { user: string; product: string; group: string };

/** Xodimning boshqa KPI guruhida allaqachon turgan tovarlar. */
export function formatKpiProductConflict(hits: Hit[]): string {
  const lines = hits.slice(0, 8).map((h) => `${h.user}: товар «${h.product}» уже в группе «${h.group}»`);
  const more = hits.length > 8 ? ` Ещё ${hits.length - 8}.` : "";
  return `Один сотрудник — один товар только в одной KPI-группе. ${lines.join("; ")}.${more}`;
}

/**
 * Bir xodimning KPI guruhlarida tovar takrorlanmasin.
 * Guruh nofaol bo‘lsa tekshiruv shart emas — hisobga kirmaydi.
 */
export async function assertUniqueKpiProducts(
  tenantId: number,
  groupId: number | null,
  productIds: number[],
  userIds: number[]
): Promise<void> {
  const products = [...new Set(productIds)];
  const users = [...new Set(userIds)];
  if (!products.length || !users.length) return;
  const rows = await prisma.kpiGroupAgent.findMany({
    where: {
      user_id: { in: users },
      ...(groupId != null ? { kpi_group_id: { not: groupId } } : {}),
      kpi_group: { tenant_id: tenantId, is_active: true, products: { some: { product_id: { in: products } } } }
    },
    select: {
      user: { select: { name: true } },
      kpi_group: {
        select: {
          name: true,
          products: {
            where: { product_id: { in: products } },
            select: { product: { select: { name: true } } }
          }
        }
      }
    }
  });
  const hits: Hit[] = [];
  for (const row of rows) {
    for (const p of row.kpi_group.products) {
      hits.push({ user: row.user.name.trim() || "Сотрудник", product: p.product.name, group: row.kpi_group.name });
    }
  }
  if (hits.length) throw new KpiProductConflictError(formatKpiProductConflict(hits));
}
