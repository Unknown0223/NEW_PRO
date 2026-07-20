import { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "../../config/database";
import type { MigrationConflictPolicy } from "./system-migration.constants";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { emptyIdMaps } from "./system-migration.id-maps";
import { importExtendedPhases } from "./system-migration.extended.import";
import {
  asDecimal,
  asIsoDate,
  hydrateDates,
  hydrateDecimals,
  readZipJson,
  remapId,
  stripIdTenant
} from "./system-migration.parse";

type ZipLike = JSZip;

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

/** Prisma update’da `tenant_id` / kalit maydonlarni uzatmaslik. */
function omitKeys<T extends Record<string, unknown>>(row: T, keys: string[]): Record<string, unknown> {
  const next: Record<string, unknown> = { ...row };
  for (const k of keys) delete next[k];
  return next;
}

export type ReferenceImportResult = {
  maps: MigrationIdMaps;
  counts: Record<string, number>;
  warnings: string[];
};

export async function importReferenceTables(
  zip: ZipLike,
  tenantId: number,
  opts?: { conflictPolicy?: MigrationConflictPolicy }
): Promise<ReferenceImportResult> {
  const conflictPolicy: MigrationConflictPolicy =
    opts?.conflictPolicy === "replace" ? "replace" : "keep";
  const maps = emptyIdMaps();
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  const [tradeDirections, salesChannels, warehouses, users, clients, products, cashDesks, stocks] =
    await Promise.all([
      readZipJson<Record<string, unknown>>(zip, "data/trade_directions.json"),
      readZipJson<Record<string, unknown>>(zip, "data/sales_channel_refs.json"),
      readZipJson<Record<string, unknown>>(zip, "data/warehouses.json"),
      readZipJson<Record<string, unknown>>(zip, "data/users.json"),
      readZipJson<Record<string, unknown>>(zip, "data/clients.json"),
      readZipJson<Record<string, unknown>>(zip, "data/products.json"),
      readZipJson<Record<string, unknown>>(zip, "data/cash_desks.json"),
      readZipJson<Record<string, unknown>>(zip, "data/stock.json")
    ]);

  if (!warehouses.length && !users.length && !clients.length) {
    warnings.push("data/warehouses|users|clients.json yo‘q — operatsion import o‘tkazib yuboriladi.");
    return { maps, counts, warnings };
  }

  await prisma.$transaction(
    async (tx) => {
    await importExtendedPhases(tx, zip, tenantId, maps, [0], warnings, {
      strictFk: false,
      skipDuplicateKeys: true,
      conflictPolicy
    });

    for (const row of warehouses) {
      const oldId = Number(row.id);
      const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
      const code = asTrimmedString(data.code);
      const name = asTrimmedString(data.name);
      const existing =
        (code
          ? await tx.warehouse.findFirst({ where: { tenant_id: tenantId, code } })
          : null) ??
        (name
          ? await tx.warehouse.findFirst({ where: { tenant_id: tenantId, name } })
          : null);
      if (existing) {
        if (conflictPolicy === "replace") {
          await tx.warehouse.update({
            where: { id: existing.id },
            data: omitKeys(data, ["tenant_id"]) as Prisma.WarehouseUncheckedUpdateInput
          });
        }
        maps.warehouse.set(oldId, existing.id);
      } else {
        const created = await tx.warehouse.create({
          data: {
            ...(data as Prisma.WarehouseUncheckedCreateInput),
            tenant_id: tenantId
          }
        });
        maps.warehouse.set(oldId, created.id);
      }
    }
    counts.warehouses = warehouses.length;

    for (const row of tradeDirections) {
      const oldId = Number(row.id);
      const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
      const code = asTrimmedString(data.code);
      const name = asTrimmedString(data.name);
      const existing =
        (code
          ? await tx.tradeDirection.findUnique({
              where: { tenant_id_code: { tenant_id: tenantId, code } }
            })
          : null) ??
        (name
          ? await tx.tradeDirection.findFirst({ where: { tenant_id: tenantId, name } })
          : null);
      if (existing) {
        if (conflictPolicy === "replace") {
          await tx.tradeDirection.update({
            where: { id: existing.id },
            data: omitKeys(data, ["tenant_id"]) as Prisma.TradeDirectionUncheckedUpdateInput
          });
        }
        maps.tradeDirection.set(oldId, existing.id);
      } else {
        const created = await tx.tradeDirection.create({
          data: {
            ...(data as Prisma.TradeDirectionUncheckedCreateInput),
            tenant_id: tenantId
          }
        });
        maps.tradeDirection.set(oldId, created.id);
      }
    }
    counts.trade_directions = tradeDirections.length;

    for (const row of salesChannels) {
      const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
      const code = asTrimmedString(data.code);
      const name = asTrimmedString(data.name);
      const existing =
        (code
          ? await tx.salesChannelRef.findUnique({
              where: { tenant_id_code: { tenant_id: tenantId, code } }
            })
          : null) ??
        (name
          ? await tx.salesChannelRef.findFirst({ where: { tenant_id: tenantId, name } })
          : null);
      if (existing) {
        if (conflictPolicy === "replace") {
          await tx.salesChannelRef.update({
            where: { id: existing.id },
            data: omitKeys(data, ["tenant_id"]) as Prisma.SalesChannelRefUncheckedUpdateInput
          });
        }
      } else {
        await tx.salesChannelRef.create({
          data: {
            ...(data as Prisma.SalesChannelRefUncheckedCreateInput),
            tenant_id: tenantId
          }
        });
      }
    }
    counts.sales_channel_refs = salesChannels.length;

    for (const row of users) {
      const oldId = Number(row.id);
      let data = hydrateDecimals(hydrateDates(stripIdTenant(row), [
        "created_at",
        "updated_at",
        "consignment_updated_at",
        "last_sync_at"
      ]), ["consignment_limit_amount"]);
      data = {
        ...data,
        warehouse_id: remapId(maps.warehouse, data.warehouse_id) ?? null,
        return_warehouse_id: remapId(maps.warehouse, data.return_warehouse_id) ?? null,
        supervisor_user_id: null,
        trade_direction_id: null
      };
      const login = asTrimmedString(data.login);
      data = { ...data, login };
      const existing = login
        ? await tx.user.findFirst({
            where: { tenant_id: tenantId, login: { equals: login, mode: "insensitive" } }
          })
        : null;
      if (existing) {
        // Bo‘sh bo‘lmagan tenant: login bor — map; replace da yangilash.
        if (conflictPolicy === "replace") {
          await tx.user.update({
            where: { id: existing.id },
            data: omitKeys(data, ["tenant_id", "login"]) as Prisma.UserUncheckedUpdateInput
          });
        }
        maps.user.set(oldId, existing.id);
        continue;
      }
      try {
        const created = await tx.user.create({
          data: {
            ...(data as Prisma.UserUncheckedCreateInput),
            tenant_id: tenantId,
            login
          }
        });
        maps.user.set(oldId, created.id);
      } catch (e) {
        // Race / case / parallel: create P2002 bo‘lsa — mavjud userga map qilamiz.
        const code =
          e !== null && typeof e === "object" && "code" in e
            ? String((e as { code?: unknown }).code ?? "")
            : "";
        if (code !== "P2002" || !login) throw e;
        const again = await tx.user.findFirst({
          where: { tenant_id: tenantId, login: { equals: login, mode: "insensitive" } }
        });
        if (!again) throw e;
        maps.user.set(oldId, again.id);
      }
    }
    counts.users = users.length;

    if (conflictPolicy === "replace") {
      for (const row of users) {
        const oldId = Number(row.id);
        const newId = maps.user.get(oldId);
        if (!newId) continue;
        const supervisor = remapId(maps.user, row.supervisor_user_id);
        const tradeDirection = remapId(maps.tradeDirection, row.trade_direction_id);
        const userPatch: Prisma.UserUncheckedUpdateInput = {};
        if (supervisor != null) userPatch.supervisor_user_id = supervisor;
        if (tradeDirection != null) userPatch.trade_direction_id = tradeDirection;
        if (Object.keys(userPatch).length) {
          await tx.user.update({ where: { id: newId }, data: userPatch });
        }
      }
    }

    for (const row of clients) {
      const oldId = Number(row.id);
      const data = hydrateDecimals(
        hydrateDates(stripIdTenant(row), [
          "created_at",
          "updated_at",
          "license_until",
          "visit_date",
          "last_visit_at"
        ]),
        ["credit_limit", "latitude", "longitude"]
      );
      const agentId = remapId(maps.user, data.agent_id);
      const clientCode = asTrimmedString(data.client_code);
      const phoneNorm = asTrimmedString(data.phone_normalized);
      const existing =
        (clientCode
          ? await tx.client.findFirst({ where: { tenant_id: tenantId, client_code: clientCode } })
          : null) ??
        (phoneNorm
          ? await tx.client.findFirst({ where: { tenant_id: tenantId, phone_normalized: phoneNorm } })
          : null);
      if (existing) {
        if (conflictPolicy === "replace") {
          await tx.client.update({
            where: { id: existing.id },
            data: {
              ...(omitKeys(data, ["tenant_id"]) as Prisma.ClientUncheckedUpdateInput),
              agent_id: agentId ?? null,
              merged_into_client_id: null
            }
          });
        }
        maps.client.set(oldId, existing.id);
      } else {
        const created = await tx.client.create({
          data: {
            ...(data as Prisma.ClientUncheckedCreateInput),
            tenant_id: tenantId,
            agent_id: agentId ?? null,
            merged_into_client_id: null
          }
        });
        maps.client.set(oldId, created.id);
      }
    }
    counts.clients = clients.length;

    for (const row of products) {
      const oldId = Number(row.id);
      const data = hydrateDecimals(
        hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]),
        ["weight_kg", "volume_m3", "width_cm", "height_cm", "length_cm"]
      );
      const sku = asTrimmedString(data.sku);
      const catalogIds = {
        category_id: remapId(maps.productCategory, row.category_id) ?? null,
        product_group_id: remapId(maps.productCatalogGroup, row.product_group_id) ?? null,
        brand_id: remapId(maps.productBrand, row.brand_id) ?? null,
        manufacturer_id: remapId(maps.productManufacturer, row.manufacturer_id) ?? null,
        segment_id: remapId(maps.productSegment, row.segment_id) ?? null
      };
      const existing = sku
        ? await tx.product.findUnique({
            where: { tenant_id_sku: { tenant_id: tenantId, sku } }
          })
        : null;
      const productName = asTrimmedString(data.name);
      const existingByName =
        !existing && productName
          ? await tx.product.findFirst({
              where: {
                tenant_id: tenantId,
                name: { equals: productName, mode: "insensitive" }
              }
            })
          : null;
      // Nom dublikati: SKU boshqacha bo‘lsa ham yangi qator yaratilmasin
      const resolved = existing ?? existingByName;
      if (resolved) {
        if (conflictPolicy === "replace") {
          await tx.product.update({
            where: { id: resolved.id },
            data: {
              ...(omitKeys(data, ["tenant_id", "sku"]) as Prisma.ProductUncheckedUpdateInput),
              ...catalogIds
            }
          });
        } else if (existingByName && !existing) {
          warnings.push(
            `product name skip: «${productName}» already exists as SKU ${existingByName.sku} (incoming SKU ${sku || "—"})`
          );
        }
        maps.product.set(oldId, resolved.id);
      } else {
        const created = await tx.product.create({
          data: {
            ...(data as Prisma.ProductUncheckedCreateInput),
            tenant_id: tenantId,
            ...catalogIds
          }
        });
        maps.product.set(oldId, created.id);
      }
    }
    counts.products = products.length;

    for (const row of cashDesks) {
      const oldId = Number(row.id);
      const data = hydrateDecimals(
        hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]),
        ["latitude", "longitude"]
      );
      const code = asTrimmedString(data.code);
      const name = asTrimmedString(data.name);
      const existing =
        (code
          ? await tx.cashDesk.findFirst({ where: { tenant_id: tenantId, code } })
          : null) ??
        (name ? await tx.cashDesk.findFirst({ where: { tenant_id: tenantId, name } }) : null);
      if (existing) {
        if (conflictPolicy === "replace") {
          await tx.cashDesk.update({
            where: { id: existing.id },
            data: omitKeys(data, ["tenant_id"]) as Prisma.CashDeskUncheckedUpdateInput
          });
        }
        maps.cashDesk.set(oldId, existing.id);
      } else {
        const created = await tx.cashDesk.create({
          data: {
            ...(data as Prisma.CashDeskUncheckedCreateInput),
            tenant_id: tenantId
          }
        });
        maps.cashDesk.set(oldId, created.id);
      }
    }
    counts.cash_desks = cashDesks.length;

    for (const row of stocks) {
      const data = hydrateDecimals(stripIdTenant(row), ["qty", "reserved_qty"]);
      const warehouseId = remapId(maps.warehouse, data.warehouse_id);
      const productId = remapId(maps.product, data.product_id);
      if (warehouseId == null || productId == null) {
        warnings.push(`Stock qatori o‘tkazib yuborildi (warehouse/product map yo‘q).`);
        continue;
      }
      if (conflictPolicy === "keep") {
        const existingStock = await tx.stock.findUnique({
          where: {
            tenant_id_warehouse_id_product_id: {
              tenant_id: tenantId,
              warehouse_id: warehouseId,
              product_id: productId
            }
          }
        });
        if (existingStock) continue;
      }
      await tx.stock.upsert({
        where: {
          tenant_id_warehouse_id_product_id: {
            tenant_id: tenantId,
            warehouse_id: warehouseId,
            product_id: productId
          }
        },
        create: {
          ...(data as Prisma.StockUncheckedCreateInput),
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId
        },
        update: {
          qty: asDecimal(data.qty) ?? new Prisma.Decimal(0),
          reserved_qty: asDecimal(data.reserved_qty) ?? new Prisma.Decimal(0)
        }
      });
    }
    counts.stock = stocks.length;
  },
    { timeout: 600_000 }
  );

  return { maps, counts, warnings };
}
