/**
 * Tenant `settings.references.price_type_entries` / `payment_method_entries`
 * nomlarini «kod o‘rniga odamcha nom» ga yaqinlashtirish.
 *
 * Qoidalar (faqat xavfsiz holatlar):
 * 1) `name === code` (yoki name faqat raqamli/smart-kod) va bog‘langan
 *    payment_method da yaxshiroq nom bo‘lsa → price type name = payment method name
 * 2) Ma’lum translit/qisqartmalar: Naxt→Наличные, Pereches/Perechis→Перечисление,
 *    Terminal→Терминал (faqat name shu kalitlarga teng bo‘lsa)
 *
 * Ishga tushirish (dry-run, hech narsa yozmaydi):
 *   npx tsx scripts/normalize-price-type-names.ts
 *
 * Yozish:
 *   CONFIRM_NORMALIZE_PRICE_TYPE_NAMES=YES npx tsx scripts/normalize-price-type-names.ts
 *
 * Tenant:
 *   IMPORT_TENANT_SLUG=test1 …
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import {
  paymentMethodsFromUnknown,
  priceTypeEntriesFromUnknown,
  type PaymentMethodEntryDto,
  type PriceTypeEntryDto
} from "../src/modules/tenant-settings/finance-refs";

const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";
const APPLY = (process.env.CONFIRM_NORMALIZE_PRICE_TYPE_NAMES ?? "").trim().toUpperCase() === "YES";

const NAME_ALIASES: Record<string, string> = {
  naxt: "Наличные",
  naqd: "Наличные",
  "naqd pul": "Наличные",
  "naqd_pul": "Наличные",
  cash: "Наличные",
  terminal: "Терминал",
  term: "Терминал",
  pereches: "Перечисление",
  perechis: "Перечисление",
  perechisleniye: "Перечисление",
  perechislenie: "Перечисление",
  transfer: "Перечисление",
  bank: "Перечисление"
};

function isCodeLikeName(name: string, code: string | null): boolean {
  const n = name.trim();
  if (!n) return true;
  const c = (code ?? "").trim();
  if (c && n.toLowerCase() === c.toLowerCase()) return true;
  // faqat raqam / qisqa smart-kod
  if (/^[0-9]{1,6}$/.test(n)) return true;
  if (/^[A-Z0-9_]{1,8}$/.test(n) && n === n.toUpperCase() && n.length <= 6) return true;
  return false;
}

function aliasName(raw: string): string | null {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  return NAME_ALIASES[k] ?? NAME_ALIASES[k.replace(/ /g, "_")] ?? null;
}

function betterName(
  current: string,
  code: string | null,
  fallbackFromPayment?: string | null
): string | null {
  const alias = aliasName(current);
  if (alias && alias !== current) return alias;
  if (isCodeLikeName(current, code)) {
    const fromPay = (fallbackFromPayment ?? "").trim();
    if (fromPay) {
      const payAlias = aliasName(fromPay);
      if (payAlias) return payAlias;
      if (!isCodeLikeName(fromPay, null)) return fromPay;
    }
  }
  return null;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
  if (!tenant) throw new Error(`Tenant ${TENANT} topilmadi`);

  const settings = (tenant.settings ?? {}) as Record<string, unknown>;
  const refs = { ...((settings.references ?? {}) as Record<string, unknown>) };
  const payMethods = paymentMethodsFromUnknown(refs.payment_method_entries);
  const priceTypes = priceTypeEntriesFromUnknown(refs.price_type_entries);
  const payById = new Map(payMethods.map((p) => [p.id, p]));

  const payChanges: Array<{ id: string; from: string; to: string; code: string | null }> = [];
  const nextPay: PaymentMethodEntryDto[] = payMethods.map((p) => {
    const to = betterName(p.name, p.code, null);
    if (!to) return p;
    payChanges.push({ id: p.id, from: p.name, to, code: p.code });
    return { ...p, name: to };
  });

  const payByIdNext = new Map(nextPay.map((p) => [p.id, p]));
  const ptChanges: Array<{
    id: string;
    from: string;
    to: string;
    code: string | null;
    via: string;
  }> = [];
  const nextPt: PriceTypeEntryDto[] = priceTypes.map((e) => {
    const pay = payByIdNext.get(e.payment_method_id) ?? payById.get(e.payment_method_id);
    const to = betterName(e.name, e.code, pay?.name ?? null);
    if (!to) return e;
    ptChanges.push({
      id: e.id,
      from: e.name,
      to,
      code: e.code,
      via: pay?.name ? `payment_method=${pay.name}` : "alias"
    });
    return { ...e, name: to };
  });

  console.log(`Tenant: ${TENANT} (id=${tenant.id}) apply=${APPLY}`);
  console.log(`payment_method_entries o‘zgarishlar: ${payChanges.length}`);
  for (const c of payChanges) {
    console.log(`  [pay] «${c.from}» → «${c.to}» (code=${c.code ?? "—"})`);
  }
  console.log(`price_type_entries o‘zgarishlar: ${ptChanges.length}`);
  for (const c of ptChanges) {
    console.log(`  [pt] «${c.from}» → «${c.to}» (code=${c.code ?? "—"}, ${c.via})`);
  }

  if (!payChanges.length && !ptChanges.length) {
    console.log("O‘zgarish yo‘q.");
    return;
  }

  if (!APPLY) {
    console.log("\nDry-run. Yozish uchun: CONFIRM_NORMALIZE_PRICE_TYPE_NAMES=YES");
    return;
  }

  refs.payment_method_entries = nextPay;
  refs.price_type_entries = nextPt;
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: { ...settings, references: refs } as Prisma.InputJsonValue
    }
  });
  console.log("Saqlandi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
