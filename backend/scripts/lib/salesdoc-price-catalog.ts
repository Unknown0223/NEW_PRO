/**
 * SalesDoc tovar sahifasidagi buyPrices / purchasePrices ni
 * tenant sozlamasidagi «Тип цены» va «Наличные» to‘lov usuliga yozadi.
 * Mavjud yozuvni kod bo‘yicha yangilaydi, qolgan spravochniklarga tegmaydi.
 */
import type { PrismaClient } from "@prisma/client";
import type { SdPriceType } from "./salesdoc-andijon-load";

const PAYMENT_ID = "pm-naxt";
const TENANT = 1;

type RefBag = Record<string, unknown>;

function asRecord(v: unknown): RefBag {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as RefBag) : {};
}

function asList(v: unknown): RefBag[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") as RefBag[] : [];
}

function codeOf(id: string): string {
  return id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 20);
}

export async function applySalesDocPriceCatalog(prisma: PrismaClient, priceTypes: SdPriceType[]) {
  const tenant = await prisma.tenant.findUnique({ where: { id: TENANT }, select: { settings: true } });
  const settings = asRecord(tenant?.settings);
  const references = asRecord(settings.references);
  const methods = asList(references.payment_method_entries);
  if (!methods.some((m) => m.id === PAYMENT_ID)) {
    methods.push({
      id: PAYMENT_ID,
      name: "Наличные",
      code: "NAXT",
      currency_code: "UZS",
      sort_order: 1,
      comment: null,
      color: null,
      active: true,
      sync_with_1c: false
    });
  }
  const currencies = asList(references.currency_entries);
  if (!currencies.some((c) => String(c.code ?? "").toUpperCase() === "UZS")) {
    currencies.push({
      id: "default-uzs",
      name: "So'm",
      code: "UZS",
      sort_order: 1,
      active: true,
      is_default: currencies.length === 0
    });
  }
  const entries = asList(references.price_type_entries);
  let updated = 0;
  let created = 0;
  priceTypes.forEach((pt, index) => {
    const code = codeOf(pt.id);
    const row = {
      id: `pt-${pt.id}`,
      name: pt.name,
      code,
      payment_method_id: PAYMENT_ID,
      kind: pt.kind,
      sort_order: index + 1,
      comment: null,
      active: true,
      manual: false,
      attached_clients_only: false
    };
    const at = entries.findIndex((e) => String(e.code ?? "").toUpperCase() === code || e.id === row.id);
    if (at >= 0) {
      entries[at] = { ...entries[at], ...row, id: entries[at].id ?? row.id };
      updated += 1;
    } else {
      entries.push(row);
      created += 1;
    }
  });
  references.payment_method_entries = methods;
  references.currency_entries = currencies;
  references.price_type_entries = entries;
  settings.references = references;
  await prisma.tenant.update({ where: { id: TENANT }, data: { settings: settings as object } });
  return { created, updated, total: entries.length, paymentMethods: methods.length };
}
