import { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "../../config/database";
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

export type ReferenceImportResult = {
  maps: MigrationIdMaps;
  counts: Record<string, number>;
  warnings: string[];
};

export async function importReferenceTables(
  zip: ZipLike,
  tenantId: number
): Promise<ReferenceImportResult> {
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

  await prisma.$transaction(async (tx) => {
    await importExtendedPhases(tx, zip, tenantId, maps, [0], warnings, { strictFk: false });

    for (const row of warehouses) {
      const oldId = Number(row.id);
      const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
      const created = await tx.warehouse.create({
        data: {
          ...(data as Prisma.WarehouseUncheckedCreateInput),
          tenant_id: tenantId
        }
      });
      maps.warehouse.set(oldId, created.id);
    }
    counts.warehouses = warehouses.length;

    for (const row of tradeDirections) {
      const oldId = Number(row.id);
      const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
      const created = await tx.tradeDirection.create({
        data: {
          ...(data as Prisma.TradeDirectionUncheckedCreateInput),
          tenant_id: tenantId
        }
      });
      maps.tradeDirection.set(oldId, created.id);
    }
    counts.trade_directions = tradeDirections.length;

    for (const row of salesChannels) {
      const data = hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]);
      await tx.salesChannelRef.create({
        data: {
          ...(data as Prisma.SalesChannelRefUncheckedCreateInput),
          tenant_id: tenantId
        }
      });
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
      const created = await tx.user.create({
        data: {
          ...(data as Prisma.UserUncheckedCreateInput),
          tenant_id: tenantId
        }
      });
      maps.user.set(oldId, created.id);
    }
    counts.users = users.length;

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
    counts.clients = clients.length;

    for (const row of products) {
      const oldId = Number(row.id);
      const data = hydrateDecimals(
        hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]),
        ["weight_kg", "volume_m3", "width_cm", "height_cm", "length_cm"]
      );
      const created = await tx.product.create({
        data: {
          ...(data as Prisma.ProductUncheckedCreateInput),
          tenant_id: tenantId,
          category_id: remapId(maps.productCategory, row.category_id) ?? null,
          product_group_id: remapId(maps.productCatalogGroup, row.product_group_id) ?? null,
          brand_id: remapId(maps.productBrand, row.brand_id) ?? null,
          manufacturer_id: remapId(maps.productManufacturer, row.manufacturer_id) ?? null,
          segment_id: remapId(maps.productSegment, row.segment_id) ?? null
        }
      });
      maps.product.set(oldId, created.id);
    }
    counts.products = products.length;

    for (const row of cashDesks) {
      const oldId = Number(row.id);
      const data = hydrateDecimals(
        hydrateDates(stripIdTenant(row), ["created_at", "updated_at"]),
        ["latitude", "longitude"]
      );
      const created = await tx.cashDesk.create({
        data: {
          ...(data as Prisma.CashDeskUncheckedCreateInput),
          tenant_id: tenantId
        }
      });
      maps.cashDesk.set(oldId, created.id);
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
  });

  return { maps, counts, warnings };
}
