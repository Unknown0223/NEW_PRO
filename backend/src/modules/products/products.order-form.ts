import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";

/** Yangi zakaz formasi: faol mahsulotlar + narxlar (API `include_prices` bilan bir xil JSON). */
export async function listProductsForOrderCreateForm(
  tenantId: number,
  options?: { product_ids?: number[] }
) {
  const ids = Array.isArray(options?.product_ids)
    ? options.product_ids.filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const useScopedIds = ids.length > 0;
  const limitNum = 100;
  const includeBlock = {
    category: { select: { id: true, name: true } },
    prices: { select: { price_type: true, price: true, currency: true } }
  } as const;

  const mapRow = (r: {
    id: number;
    sku: string;
    name: string;
    unit: string;
    category_id: number | null;
    volume_m3: Prisma.Decimal | null;
    qty_per_block: number | null;
    sort_order: number | null;
    is_blocked: boolean;
    category: { id: number; name: string } | null;
    prices: { price_type: string; price: Prisma.Decimal; currency: string }[];
  }) => ({
    id: r.id,
    sku: r.sku,
    name: r.name,
    unit: r.unit,
    category_id: r.category_id,
    volume_m3: r.volume_m3 != null ? r.volume_m3.toString() : null,
    qty_per_block: r.qty_per_block,
    sort_order: r.sort_order,
    is_blocked: r.is_blocked,
    category: r.category ?? null,
    prices: r.prices.map((p) => ({
      price_type: p.price_type,
      price: p.price.toString(),
      currency: p.currency
    }))
  });

  if (!useScopedIds) {
    const rows = await prisma.product.findMany({
      where: { tenant_id: tenantId, is_active: true },
      take: limitNum,
      orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
      include: includeBlock
    });
    return rows.map(mapRow);
  }

  /** Juda katta `IN (...)` bitta so‘rovda reja va tarmoqni og‘irlashtiradi. */
  const CHUNK = env.ORDER_CREATE_PRODUCT_CHUNK;
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    chunks.push(ids.slice(i, i + CHUNK));
  }

  type Row = Awaited<ReturnType<typeof prisma.product.findMany<{ include: typeof includeBlock }>>>[number];
  const parts: Row[] = [];
  const PAR = env.ORDER_CREATE_PRODUCT_CHUNK_PARALLEL;
  for (let i = 0; i < chunks.length; i += PAR) {
    const batch = chunks.slice(i, i + PAR);
    const batchRows = await Promise.all(
      batch.map((chunk) =>
        prisma.product.findMany({
          where: { tenant_id: tenantId, is_active: true, id: { in: chunk } },
          orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
          include: includeBlock
        })
      )
    );
    for (const br of batchRows) parts.push(...br);
  }

  const byId = new Map<number, Row>();
  for (const r of parts) {
    byId.set(r.id, r);
  }
  const merged = [...byId.values()].sort((a, b) => {
    const sa = a.sort_order ?? 0;
    const sb = b.sort_order ?? 0;
    if (sa !== sb) return sa - sb;
    const nc = a.name.localeCompare(b.name, "uz");
    if (nc !== 0) return nc;
    return a.id - b.id;
  });

  return merged.map(mapRow);
}

