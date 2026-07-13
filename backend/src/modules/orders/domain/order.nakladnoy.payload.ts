/**
 * Nakladnoy order payload mapping and DB load.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import type { NakladnoyLine, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx";

export const NAKLADNOY_TEMPLATE_IDS = ["nakladnoy_warehouse", "nakladnoy_expeditor"] as const;
export type NakladnoyTemplateId = (typeof NAKLADNOY_TEMPLATE_IDS)[number];

export type BulkNakladnoyFileResult = {
  buffer: Buffer;
  filename: string;
  template: NakladnoyTemplateId;
  format: "xlsx" | "pdf";
  order_ids: number[];
};

type OrderNakladnoyDb = {
  id: number;
  number: string;
  agent_id: number | null;
  expeditor_user_id: number | null;
  created_at: Date;
  tenant: { name: string; phone: string | null };
  warehouse: { name: string } | null;
  agent: {
    login: string;
    name: string;
    code: string | null;
    phone: string | null;
    territory: string | null;
    branch: string | null;
    created_at: Date;
  } | null;
  expeditor_user: {
    login: string;
    name: string;
    code: string | null;
    phone: string | null;
    branch: string | null;
    created_at: Date;
  } | null;
  client: {
    name: string;
    address: string | null;
    region: string | null;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    street: string | null;
    house_number: string | null;
    phone: string | null;
    client_balances: { balance: Prisma.Decimal }[];
  };
  items: Array<{
    id: number;
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: boolean;
    product: {
      sku: string;
      barcode: string | null;
      name: string;
      qty_per_block: number | null;
      category: { name: string } | null;
      product_group: { name: string } | null;
    };
  }>;
};

function fmtRuDateShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function mapOrderToNakladnoyPayload(o: OrderNakladnoyDb): NakladnoyOrderPayload {
  const bal = o.client.client_balances[0]?.balance ?? null;
  const ag = o.agent;
  const agentLine = ag
    ? `${ag.code?.trim() || ag.login}- [${ag.name}]${ag.phone?.trim() ? ` ${ag.phone.trim()}` : ""}`
    : "—";
  const ex = o.expeditor_user;
  const tag = (ex?.branch ?? ex?.code ?? ex?.login ?? "").toString().trim() || "—";
  const expeditorLine = ex
    ? `[${tag}] ${ex.name} (${fmtRuDateShort(ex.created_at)})${ex.phone?.trim() ? ` ${ex.phone.trim()}` : ""}`
    : "—";
  const territory =
    o.client.region?.trim() || ag?.territory?.trim() || "—";
  const addrParts = [
    o.client.region,
    o.client.city,
    o.client.district,
    o.client.neighborhood,
    o.client.street,
    o.client.house_number
  ]
    .map((x) => (x ?? "").trim())
    .filter(Boolean);
  const clientAddress = (o.client.address?.trim() || addrParts.join(", ") || "—").trim();

  const bonusQtyByProduct = new Map<number, Prisma.Decimal>();
  for (const it of o.items) {
    if (!it.is_bonus) continue;
    const prev = bonusQtyByProduct.get(it.product_id) ?? new Prisma.Decimal(0);
    bonusQtyByProduct.set(it.product_id, prev.add(it.qty));
  }

  const groupTitleOf = (it: (typeof o.items)[0]) =>
    it.product.product_group?.name?.trim() ||
    it.product.category?.name?.trim() ||
    "Прочее";

  const lines: NakladnoyLine[] = [];
  const paidLines: NakladnoyLine[] = [];
  const bonusLines: NakladnoyLine[] = [];

  for (const it of o.items) {
    if (it.is_bonus) {
      const ln: NakladnoyLine = {
        productId: it.product_id,
        sku: it.product.sku,
        barcode: it.product.barcode,
        name: it.product.name,
        qty: Number(it.qty.toString()),
        bonusQty: 0,
        price: Number(it.price.toString()),
        sum: Number(it.total.toString()),
        groupTitle: groupTitleOf(it),
        qtyPerBlock: it.product.qty_per_block
      };
      bonusLines.push(ln);
      continue;
    }
    let bonusQty = 0;
    if (bonusQtyByProduct.has(it.product_id)) {
      const bdec = bonusQtyByProduct.get(it.product_id)!;
      bonusQty = Number(bdec.toString());
      bonusQtyByProduct.delete(it.product_id);
    }
    const ln: NakladnoyLine = {
      productId: it.product_id,
      sku: it.product.sku,
      barcode: it.product.barcode,
      name: it.product.name,
      qty: Number(it.qty.toString()),
      bonusQty,
      price: Number(it.price.toString()),
      sum: Number(it.total.toString()),
      groupTitle: groupTitleOf(it),
      qtyPerBlock: it.product.qty_per_block
    };
    lines.push(ln);
    paidLines.push(ln);
  }

  for (const it of o.items) {
    if (!it.is_bonus) continue;
    const hasPaid = o.items.some((x) => !x.is_bonus && x.product_id === it.product_id);
    if (hasPaid) continue;
    lines.push({
      productId: it.product_id,
      sku: it.product.sku,
      barcode: it.product.barcode,
      name: it.product.name,
      qty: 0,
      bonusQty: Number(it.qty.toString()),
      price: 0,
      sum: 0,
      groupTitle: groupTitleOf(it),
      qtyPerBlock: it.product.qty_per_block
    });
  }

  return {
    id: o.id,
    number: o.number,
    createdAt: o.created_at,
    agentId: o.agent_id,
    expeditorUserId: o.expeditor_user_id,
    tenantName: o.tenant.name,
    tenantPhone: o.tenant.phone,
    clientName: o.client.name,
    clientBalanceNum: bal,
    clientAddress,
    currencyLabel: "So'm (UZS)",
    agentLine,
    expeditorLine,
    territory,
    warehouseName: o.warehouse?.name ?? null,
    lines,
    paidLines,
    bonusLines
  };
}

export async function loadBulkNakladnoyOrderPayloads(
  tenantId: number,
  orderIds: number[]
): Promise<{ ids: number[]; ordered: NakladnoyOrderPayload[] }> {
  const ids = [...new Set(orderIds.filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
  if (ids.length === 0) {
    throw new Error("EMPTY_ORDER_IDS");
  }
  if (ids.length > 500) {
    throw new Error("TOO_MANY_ORDERS");
  }
  const rows = await prisma.order.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true }
  });
  const found = new Set(rows.map((r) => r.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    const err = new Error("ORDERS_NOT_FOUND") as Error & { missing_ids: number[] };
    err.missing_ids = missing;
    throw err;
  }

  const loaded = await prisma.order.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    orderBy: { id: "asc" },
    include: {
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
          client_balances: {
            where: { tenant_id: tenantId },
            take: 1,
            select: { balance: true }
          }
        }
      },
      items: {
        orderBy: { id: "asc" },
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
    }
  });

  const byId = new Map(loaded.map((x) => [x.id, x]));
  const ordered = ids.map((id) => byId.get(id)!).map((o) => mapOrderToNakladnoyPayload(o as OrderNakladnoyDb));
  return { ids, ordered };
}
