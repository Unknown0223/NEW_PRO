/**
 * Barcha «Загруз зав.склада» shablonlarini tanlangan zakazlar bilan generatsiya qiladi.
 * Ishga tushirish: cd backend && npx tsx scripts/audit-all-warehouse-templates.ts [orderId ...]
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { WAREHOUSE_LAYOUT_IDS } from "../src/modules/orders/warehouse-templates/warehouse-template-ids";
import { buildWarehouseLoadXlsx } from "../src/modules/orders/warehouse-templates/build-warehouse-load-xlsx";
import { DEFAULT_NAKLADNOY_BUILD_OPTIONS } from "../src/modules/orders/order-nakladnoy-xlsx.types";
import { mapOrderToNakladnoyPayload } from "../src/modules/orders/domain/order.nakladnoy";

const prisma = new PrismaClient();
const OUT = join(__dirname, "audit-output");

const orderInclude = {
  tenant: { select: { name: true, phone: true } },
  warehouse: { select: { name: true } },
  agent: {
    select: {
      login: true,
      name: true,
      code: true,
      phone: true,
      territory: true,
      branch: true,
      created_at: true
    }
  },
  expeditor_user: {
    select: {
      login: true,
      name: true,
      code: true,
      phone: true,
      branch: true,
      created_at: true
    }
  },
  client: {
    select: {
      name: true,
      address: true,
      region: true,
      city: true,
      district: true,
      neighborhood: true,
      street: true,
      house_number: true,
      phone: true,
      client_balances: { take: 1, select: { balance: true } }
    }
  },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      product: {
        select: {
          sku: true,
          barcode: true,
          name: true,
          qty_per_block: true,
          category: { select: { name: true } },
          product_group: { select: { name: true } }
        }
      }
    }
  }
};

async function main() {
  const orderArg = process.argv.slice(2).map((x) => Number(x)).filter((n) => n > 0);
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  if (!tenant) throw new Error("No tenant");
  let orderIds = orderArg;
  if (orderIds.length === 0) {
    const rows = await prisma.order.findMany({
      where: { tenant_id: tenant.id },
      take: 12,
      orderBy: { id: "asc" },
      select: { id: true }
    });
    orderIds = rows.map((r) => r.id);
  }

  mkdirSync(OUT, { recursive: true });
  const lines: string[] = [`# Audit ${new Date().toISOString()}`, `Orders: ${orderIds.join(", ")}`, ""];

  const loaded = await prisma.order.findMany({
    where: { tenant_id: tenant.id, id: { in: orderIds } },
    orderBy: { id: "asc" },
    include: orderInclude
  });
  const payloads = loaded.map((o) => mapOrderToNakladnoyPayload(o as never));

  for (const layoutId of WAREHOUSE_LAYOUT_IDS) {
    try {
      const buf = await buildWarehouseLoadXlsx(layoutId, payloads, DEFAULT_NAKLADNOY_BUILD_OPTIONS);
      const outPath = join(OUT, `warehouse_${layoutId.replace(/\./g, "_")}.xlsx`);
      writeFileSync(outPath, buf);
      const okZip = buf.length > 5000 && buf[0] === 0x50 && buf[1] === 0x4b;
      lines.push(`## ${layoutId}: ${okZip ? "OK" : "WARN"} ${buf.length} bytes`);
    } catch (e) {
      lines.push(`## ${layoutId}: FAIL ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const report = lines.join("\n");
  writeFileSync(join(OUT, "REPORT.md"), report);
  console.log(report);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
