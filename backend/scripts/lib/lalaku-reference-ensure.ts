/**
 * Lalaku spravochniklar — DB ensure + settings yozuvi.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  paymentMethodsFromUnknown,
  priceTypeEntriesFromUnknown
} from "../../src/modules/tenant-settings/finance-refs";
import { mergeTerritoryBundle, ZONE_ROOT_NAMES } from "../../../shared/territory-lalaku-seed";
import { territoryRegionPickerNames } from "../../src/modules/tenant-settings/tenant-settings.service";
import {
  CLIENT_CATEGORIES,
  CLIENT_FORMATS,
  CLIENT_TYPES,
  LALAKU_FINANCE_PAYMENT_METHODS,
  LALAKU_FINANCE_PRICE_TYPES,
  mergePaymentMethodEntries,
  mergePriceTypeEntries,
  SALES_CHANNELS,
  TRADE_DIRECTIONS,
  WAREHOUSE_NAMES
} from "./lalaku-reference-catalog";
import {
  activeValuesFromClientRefEntries,
  asRecord,
  mergeClientRefByCodeOrName,
  mergeStringList,
  parseClientRefEntries,
  parseTerritoryNodes,
  warehouseCodeFromName
} from "./lalaku-reference-territory";

async function ensureSalesChannels(prisma: PrismaClient, tenantId: number, dry: boolean) {
  console.log("\n── [1/5] Savdo kanallari → `sales_channel_refs` ──");
  for (let i = 0; i < SALES_CHANNELS.length; i++) {
    const { name, code } = SALES_CHANNELS[i];
    const existing = await prisma.salesChannelRef.findFirst({
      where: { tenant_id: tenantId, code }
    });
    if (existing) {
      console.log(`= mavjud ${code}`);
      continue;
    }
    if (dry) {
      console.log(`[dry] ${code} — ${name}`);
      continue;
    }
    await prisma.salesChannelRef.create({
      data: {
        tenant_id: tenantId,
        name,
        code,
        sort_order: i,
        is_active: true
      }
    });
    console.log(`+ ${code}`);
  }
}

async function ensureTradeDirections(prisma: PrismaClient, tenantId: number, dry: boolean) {
  console.log("\n── [2/5] Savdo yo‘nalishlari → `trade_directions` ──");
  for (const row of TRADE_DIRECTIONS) {
    const existing = await prisma.tradeDirection.findFirst({
      where: { tenant_id: tenantId, code: row.code }
    });
    if (existing) {
      if (
        existing.use_in_order_proposal !== row.use_in_order_proposal ||
        existing.name !== row.name
      ) {
        if (!dry) {
          await prisma.tradeDirection.update({
            where: { id: existing.id },
            data: {
              name: row.name,
              use_in_order_proposal: row.use_in_order_proposal,
              sort_order: row.sort_order
            }
          });
          console.log(`~ ${row.code} (yangilandi)`);
        }
      } else {
        console.log(`= mavjud ${row.code}`);
      }
      continue;
    }
    if (dry) {
      console.log(`[dry] ${row.code} — ${row.name}`);
      continue;
    }
    await prisma.tradeDirection.create({
      data: {
        tenant_id: tenantId,
        name: row.name,
        code: row.code,
        sort_order: row.sort_order,
        is_active: true,
        use_in_order_proposal: row.use_in_order_proposal
      }
    });
    console.log(`+ ${row.code}`);
  }
}

async function ensureWarehouses(prisma: PrismaClient, tenantId: number, dry: boolean) {
  console.log("\n── [3/5] Omborlar → `warehouses` ──");
  for (const name of WAREHOUSE_NAMES) {
    const found = await prisma.warehouse.findFirst({
      where: { tenant_id: tenantId, name }
    });
    if (found) {
      console.log(`= mavjud ${name}`);
      continue;
    }
    const code = warehouseCodeFromName(name);
    if (dry) {
      console.log(`[dry] ${name} (${code})`);
      continue;
    }
    await prisma.warehouse.create({
      data: {
        tenant_id: tenantId,
        name,
        type: "branch",
        code,
        stock_purpose: "sales",
        is_active: true
      }
    });
    console.log(`+ ${name}`);
  }
}

export type LalakuReferenceOptions = {
  tenantId: number;
  tenantSlug: string;
  dry: boolean;
};

/**
 * Bitta tenant uchun: zona/viloyat + mijoz formatlari (settings), kanallar, yo‘nalishlar, omborlar.
 */
export async function runLalakuReferenceImport(
  prisma: PrismaClient,
  opts: LalakuReferenceOptions
): Promise<void> {
  const { tenantId, tenantSlug, dry } = opts;

  console.log(
    "\n── (Tayyorlanmoqda) Zona/viloyat daraxti + mijoz format/kategoriya/turlar — jadval yozuvlaridan keyin `settings` ga yoziladi ──"
  );

  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = asRecord(row?.settings);
  const ref = asRecord(st.references);

  const prevNodes = parseTerritoryNodes(ref.territory_nodes);
  const mergedNodes = mergeTerritoryBundle(prevNodes);
  const mergedRegionsFlat = territoryRegionPickerNames({
    ...ref,
    territory_nodes: mergedNodes as unknown
  } as Record<string, unknown>);

  const prevZones = Array.isArray(ref.client_zones)
    ? ref.client_zones.filter((x): x is string => typeof x === "string")
    : [];
  const mergedZones = mergeStringList(prevZones, [...ZONE_ROOT_NAMES]);

  const fmtEntries = mergeClientRefByCodeOrName(
    parseClientRefEntries(ref.client_format_entries),
    CLIENT_FORMATS,
    "fmt"
  );
  const catEntries = mergeClientRefByCodeOrName(
    parseClientRefEntries(ref.client_category_entries),
    CLIENT_CATEGORIES,
    "cat"
  );
  const typEntries = mergeClientRefByCodeOrName(
    parseClientRefEntries(ref.client_type_entries),
    CLIENT_TYPES,
    "typ"
  );

  const prevPaymentMethods = paymentMethodsFromUnknown(ref.payment_method_entries);
  const mergedPaymentMethods = mergePaymentMethodEntries(
    prevPaymentMethods,
    LALAKU_FINANCE_PAYMENT_METHODS
  );
  const prevPriceTypes = priceTypeEntriesFromUnknown(ref.price_type_entries);
  const mergedPriceTypes = mergePriceTypeEntries(prevPriceTypes, LALAKU_FINANCE_PRICE_TYPES);

  const nextRef = {
    ...ref,
    territory_nodes: mergedNodes,
    regions: mergedRegionsFlat,
    client_zones: mergedZones,
    client_format_entries: fmtEntries,
    client_formats: activeValuesFromClientRefEntries(fmtEntries),
    client_category_entries: catEntries,
    client_categories: activeValuesFromClientRefEntries(catEntries),
    client_type_entries: typEntries,
    client_type_codes: activeValuesFromClientRefEntries(typEntries),
    payment_method_entries: mergedPaymentMethods,
    price_type_entries: mergedPriceTypes
  };

  await ensureSalesChannels(prisma, tenantId, dry);
  await ensureTradeDirections(prisma, tenantId, dry);
  await ensureWarehouses(prisma, tenantId, dry);

  console.log("\n── [4/5] Territoriya + mijoz spravochniklari → `tenant.settings.references` ──");
  if (dry) {
    console.log("[dry] settings.references yozilmaydi.");
  } else {
    const nextSettings = { ...st, references: nextRef };
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: nextSettings as Prisma.InputJsonValue }
    });
    console.log("✓ settings.references (territory_nodes, client_zones, format/kategoriya/turlar).");
  }

  console.log("\n── [5/5] Narx turlari + to‘lov usullari (NAQD PUL, TERMINAL, PERECHISLENIYE) ──");
  if (dry) {
    console.log("[dry] yuqoridagi bitta `tenant.update` ichida allaqachon rejalashtirilgan.");
  } else {
    console.log(
      "✓ payment_method_entries + price_type_entries (sotish) — mavjud bo‘lsa takrorlanmaydi."
    );
  }

  console.log("\n✓ Barcha spravochnik bo‘limlari tugadi (tenant: " + tenantSlug + ").");
}
