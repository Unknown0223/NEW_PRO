import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import { priceTypeEntriesFromUnknown, priceTypeKey } from "../tenant-settings/finance-refs";

export async function getPricesReportFilterOptions(tenantId: number, _actor?: ReportActor) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const entries = priceTypeEntriesFromUnknown(refs.price_type_entries).filter((e) => e.active !== false);

  const [categories, brands, products] = await Promise.all([
    prisma.productCategory.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    prisma.productBrand.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" },
      take: 3000
    })
  ]);

  return {
    price_types: entries.map((e) => ({
      id: priceTypeKey(e),
      name: e.name.trim()
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    brands: brands.map((b) => ({ id: b.id, name: b.name })),
    products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))
  };
}
