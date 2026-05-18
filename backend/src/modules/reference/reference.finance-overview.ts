import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import { settingsRefRecord } from "./reference.shared";

export type FinancePriceOverviewRow = {
  price_type: string;
  price_type_name: string;
  payment_method: string | null;
  last_price_at: string | null;
};

export async function listFinancePriceOverview(
  tenantId: number,
  kind: "sale" | "purchase"
): Promise<FinancePriceOverviewRow[]> {
  const ref = await settingsRefRecord(tenantId);
  const currencies = resolveCurrencyEntries(ref);
  const paymentMethods = resolvePaymentMethodEntries(ref, currencies);
  const pmById = new Map(paymentMethods.map((p) => [p.id, p]));
  const allEntries = priceTypeEntriesFromUnknown(ref.price_type_entries);
  const filtered = allEntries.filter((e) => e.active !== false && e.kind === kind);

  const aggregates = await prisma.productPrice.groupBy({
    by: ["price_type"],
    where: { tenant_id: tenantId },
    _max: { updated_at: true }
  });
  const lastByType = new Map(aggregates.map((a) => [a.price_type, a._max.updated_at]));

  if (filtered.length > 0) {
    return [...filtered]
      .sort((a, b) => {
        const ao = a.sort_order ?? 1_000_000;
        const bo = b.sort_order ?? 1_000_000;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name, "uz");
      })
      .map((e) => {
        const key = priceTypeKey(e);
        const last = lastByType.get(key);
        return {
          price_type: key,
          price_type_name: e.name,
          payment_method: pmById.get(e.payment_method_id)?.name ?? null,
          last_price_at: last ? last.toISOString() : null
        };
      });
  }

  // Katalog bo‘sh bo‘lsa: "legacy" turlarni ko‘rsatmaymiz (faqat sozlangandan keyin chiqadi).
  return [];
}
