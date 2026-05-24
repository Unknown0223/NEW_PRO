import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

/**
 * Seed ma’lumotlari — `docs/PHASE_PROGRESS.md` dagi test/reja bo‘limlari bilan mos.
 * Ishlatish: `npx prisma db seed`
 */

export async function ensureWarehouse(tenantId: number, name: string, type: string) {
  const found = await prisma.warehouse.findFirst({
    where: { tenant_id: tenantId, name }
  });
  if (found) return found;
  return prisma.warehouse.create({
    data: { tenant_id: tenantId, name, type }
  });
}

export async function ensureCategory(tenantId: number, name: string, parentId: number | null = null) {
  const found = await prisma.productCategory.findFirst({
    where: { tenant_id: tenantId, name }
  });
  if (found) return found;
  return prisma.productCategory.create({
    data: { tenant_id: tenantId, name, parent_id: parentId }
  });
}

type RefEntrySeed = {
  id: string;
  name: string;
  code: string | null;
  sort_order: number;
  comment: null;
  active: boolean;
  color: string | null;
};

export function refE(
  id: string,
  name: string,
  code: string | null,
  sort_order: number,
  color: string | null = null
): RefEntrySeed {
  return { id, name, code, sort_order, comment: null, active: true, color };
}

/** «Причины и категории» — bo‘sh tenantlar uchun test qiymatlari. */
const SEED_REASON_REFERENCES: Record<string, RefEntrySeed[]> = {
  request_type_entries: [
    refE("seed-req-delivery", "Yetkazib berish", "DELIVERY", 0),
    refE("seed-req-pickup", "Olib ketish (pickup)", "PICKUP", 1),
    refE("seed-req-urgent", "Shoshilinch", "URGENT", 2)
  ],
  refusal_reason_entries: [
    refE("seed-ref-client", "Mijoz rad etdi", "CLIENT_REF", 0),
    refE("seed-ref-quality", "Sifat / muddati", "QUALITY", 1),
    refE("seed-ref-price", "Narx kelishmovchiligi", "PRICE", 2)
  ],
  cancel_payment_reason_entries: [
    refE("seed-can-wrong", "Noto‘g‘ri summa", "WRONG_AMOUNT", 0),
    refE("seed-can-dup", "Dublikat to‘lov", "DUPLICATE", 1),
    refE("seed-can-other", "Boshqa", "OTHER", 2)
  ],
  order_note_entries: [
    refE("seed-on-urgent", "Shoshilinch yetkazish", "NOTE_URGENT", 0),
    refE("seed-on-tomorrow", "Ertaga yetkazish", "NOTE_TOMORROW", 1),
    refE("seed-on-call", "Oldindan qo‘ng‘iroq qilish", "NOTE_CALL", 2)
  ],
  task_type_entries: [
    refE("seed-tt-call", "Qo‘ng‘iroq", "CALL", 0),
    refE("seed-tt-visit", "Tashrif", "VISIT", 1),
    refE("seed-tt-doc", "Hujjat", "DOC", 2)
  ],
  photo_category_entries: [
    refE("seed-ph-shelf", "Do‘kon rafi", "SHELF", 0, "#22c55e"),
    refE("seed-ph-front", "Do‘kon oldi", "STOREFRONT", 1, "#3b82f6"),
    refE("seed-ph-merch", "Merchandising", "MERCH", 2, "#a855f7")
  ],
  finance_category_entries: [
    refE("seed-fc-transport", "Transport", "TRANSPORT", 0, "#f97316"),
    refE("seed-fc-marketing", "Marketing", "MARKETING", 1, "#ec4899"),
    refE("seed-fc-office", "Ofis", "OFFICE", 2, "#64748b"),
    refE("seed-fc-other", "Boshqa", "OTHER_FIN", 3, "#94a3b8")
  ]
};

export function activeStringsFromRefEntries(entries: RefEntrySeed[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.active === false) continue;
    const v = (e.code && e.code.trim() ? e.code.trim() : e.name.trim()) || "";
    if (v) out.push(v);
  }
  return [...new Set(out)].sort((a, b) => a.localeCompare(b, "uz"));
}

export async function mergeDefaultReasonReferences(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const st = (tenant?.settings ?? {}) as Record<string, unknown>;
  const prevRef =
    typeof st.references === "object" && st.references != null && !Array.isArray(st.references)
      ? { ...(st.references as Record<string, unknown>) }
      : {};
  const ref = { ...prevRef };

  for (const [key, defaults] of Object.entries(SEED_REASON_REFERENCES)) {
    const cur = ref[key];
    if (!Array.isArray(cur) || cur.length === 0) {
      ref[key] = defaults;
    }
  }

  const refusal = ref.refusal_reason_entries;
  if (Array.isArray(refusal) && refusal.length > 0) {
    ref.return_reasons = activeStringsFromRefEntries(refusal as RefEntrySeed[]);
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: { ...st, references: ref } as Prisma.InputJsonValue
    }
  });
}

export async function ensureClient(
  tenantId: number,
  name: string,
  phone: string,
  extra?: { category?: string; address?: string; credit_limit?: Prisma.Decimal }
) {
  const existing = await prisma.client.findFirst({
    where: { tenant_id: tenantId, name }
  });
  const norm = phone.replace(/\D/g, "") || "";
  if (existing) {
    if (norm) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "clients" SET "phone_normalized" = ${norm}
        WHERE "id" = ${existing.id}
          AND ("phone_normalized" IS NULL OR "phone_normalized" = '')
      `);
    }
    return existing;
  }
  const c = await prisma.client.create({
    data: {
      tenant_id: tenantId,
      name,
      phone,
      address: extra?.address ?? null,
      category: extra?.category ?? "retail",
      credit_limit: extra?.credit_limit ?? new Prisma.Decimal(0)
    }
  });
  if (norm) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "clients" SET "phone_normalized" = ${norm} WHERE "id" = ${c.id}
    `);
  }
  return c;
}

/** Qaytarish/obmen: barcha mahsulotlar bitta faol interchangeable guruhda (narx turi cheklovi yo‘q). */
export async function ensureDefaultInterchangeableGroup(
  tenantId: number,
  productIds: number[],
  opts?: { name?: string; priceTypes?: string[] }
) {
  const name = opts?.name ?? "Seed — qaytarish guruhi";
  let group = await prisma.interchangeableProductGroup.findFirst({
    where: { tenant_id: tenantId, name }
  });
  if (!group) {
    group = await prisma.interchangeableProductGroup.create({
      data: { tenant_id: tenantId, name, is_active: true }
    });
  } else {
    await prisma.interchangeableProductGroup.update({
      where: { id: group.id },
      data: { is_active: true }
    });
  }
  for (const productId of productIds) {
    await prisma.interchangeableGroupProduct.upsert({
      where: { group_id_product_id: { group_id: group.id, product_id: productId } },
      create: { group_id: group.id, product_id: productId },
      update: {}
    });
  }
  if (opts?.priceTypes?.length) {
    for (const price_type of opts.priceTypes) {
      const pt = price_type.trim();
      if (!pt) continue;
      await prisma.interchangeableGroupPriceType.upsert({
        where: { group_id_price_type: { group_id: group.id, price_type: pt } },
        create: { group_id: group.id, price_type: pt },
        update: {}
      });
    }
  }
  return group;
}

