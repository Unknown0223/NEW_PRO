import { Prisma } from "@prisma/client";
import { DATASET_ORDERS_SALES_LINES } from "./report-builder.constants";

export const FIELD_REGISTRY_PART2: Record<
  string,
  { label: string; allowRow: boolean; allowCol: boolean; expr: () => import("@prisma/client").Prisma.Sql }
> = {
  product_group_name: {
    label: "Группа",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(pgc.name, '')`
  },
  product_subcategory_name: {
    label: "Подгруппа товара",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(pcp.name, '')`
  },
  product_manufacturer_name: {
    label: "Производитель товара",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(pm.name, '')`
  },
  product_segment_name: {
    label: "Сегмент товара",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(pseg.name, '')`
  },
  product_qty_per_block: {
    label: "Кол. товара в упаковке",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(p.qty_per_block::text, '')`
  },
  /** Flat Excel «Блок»: qty / qty_per_block (yoki qty). */
  block_qty: {
    label: "Блок",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE
        WHEN COALESCE(p.qty_per_block, 0) > 0
          THEN ROUND((oi.qty / NULLIF(p.qty_per_block, 0))::numeric, 3)::text
        ELSE oi.qty::numeric(15,3)::text
      END`
  },
  product_article: {
    label: "Артикул продукта",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(NULLIF(TRIM(p.sell_code), ''), NULLIF(TRIM(p.sku), ''), '')`
  },
  product_comment: {
    label: "Комментарий",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(p.comment, '')`
  },
  kpi_group_name: {
    label: "Группа KPI",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`COALESCE((SELECT kg.name FROM kpi_group_products kgp INNER JOIN kpi_groups kg ON kg.id = kgp.kpi_group_id AND kg.tenant_id = p.tenant_id WHERE kgp.product_id = p.id ORDER BY kg.id ASC LIMIT 1), '')`
  },
  order_comment: {
    label: "Комментарий (заказ)",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(o.comment, '')`
  },
  is_consignment_label: {
    label: "Консигнация",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`(CASE WHEN o.is_consignment THEN 'Да' ELSE 'Нет' END)`
  },
  payment_method: {
    label: "Способ оплаты",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(o.payment_method_ref, '')`
  },
  order_cancel_reason: {
    label: "Причина отмены заказа",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(o.request_type_ref, '')`
  },
  return_reason: {
    label: "Причина возврата",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(sret_reason.return_reason, '')`
  },
  line_volume_m3: {
    label: "Объем товара",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`(oi.qty * COALESCE(p.volume_m3, 0::numeric))::numeric(18,6)::text`
  },
  order_total_volume_m3: {
    label: "Общий объем",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`(COALESCE((SELECT SUM(oi2.qty * COALESCE(p2.volume_m3, 0::numeric)) FROM order_items oi2 INNER JOIN products p2 ON p2.id = oi2.product_id AND p2.tenant_id = o.tenant_id WHERE oi2.order_id = o.id), 0::numeric))::numeric(18,6)::text`
  },
  order_discount_sum: {
    label: "Сумма скидки",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(o.discount_sum::text, '')`
  },
  price_type_ref: {
    label: "Тип цены",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`''`
  },
  order_date_year: {
    label: "Дата заказа.Год",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`EXTRACT(YEAR FROM o.created_at AT TIME ZONE 'UTC')::int::text`
  },
  order_date_month: {
    label: "Дата заказа.Месяц",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`EXTRACT(MONTH FROM o.created_at AT TIME ZONE 'UTC')::int::text`
  },
  order_date_day: {
    label: "Дата заказа.День",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`EXTRACT(DAY FROM o.created_at AT TIME ZONE 'UTC')::int::text`
  },
  shipped_date_year: {
    label: "Дата отгрузки.Год",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.shipped_at IS NULL THEN '' ELSE EXTRACT(YEAR FROM sl.shipped_at AT TIME ZONE 'UTC')::int::text END`
  },
  shipped_date_month: {
    label: "Дата отгрузки.Месяц",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.shipped_at IS NULL THEN '' ELSE EXTRACT(MONTH FROM sl.shipped_at AT TIME ZONE 'UTC')::int::text END`
  },
  shipped_date_day: {
    label: "Дата отгрузки.День",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.shipped_at IS NULL THEN '' ELSE EXTRACT(DAY FROM sl.shipped_at AT TIME ZONE 'UTC')::int::text END`
  },
  delivered_date_year: {
    label: "Дата доставки.Год",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.delivered_at IS NULL THEN '' ELSE EXTRACT(YEAR FROM sl.delivered_at AT TIME ZONE 'UTC')::int::text END`
  },
  delivered_date_month: {
    label: "Дата доставки.Месяц",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.delivered_at IS NULL THEN '' ELSE EXTRACT(MONTH FROM sl.delivered_at AT TIME ZONE 'UTC')::int::text END`
  },
  delivered_date_day: {
    label: "Дата доставки.День",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.delivered_at IS NULL THEN '' ELSE EXTRACT(DAY FROM sl.delivered_at AT TIME ZONE 'UTC')::int::text END`
  },
  return_date_year: {
    label: "Дата возврата.Год",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sret.return_at IS NULL THEN '' ELSE EXTRACT(YEAR FROM sret.return_at AT TIME ZONE 'UTC')::int::text END`
  },
  return_date_month: {
    label: "Дата возврата.Месяц",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sret.return_at IS NULL THEN '' ELSE EXTRACT(MONTH FROM sret.return_at AT TIME ZONE 'UTC')::int::text END`
  },
  return_date_day: {
    label: "Дата возврата.День",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sret.return_at IS NULL THEN '' ELSE EXTRACT(DAY FROM sret.return_at AT TIME ZONE 'UTC')::int::text END`
  },
  order_date: {
    label: "Дата заявки",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
  },
  shipped_date: {
    label: "Дата отгрузки",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.shipped_at IS NULL THEN '' ELSE to_char(sl.shipped_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END`
  },
  delivered_date: {
    label: "Дата доставки",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sl.delivered_at IS NULL THEN '' ELSE to_char(sl.delivered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END`
  },
  return_date: {
    label: "Дата возврата",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`CASE WHEN sret.return_at IS NULL THEN '' ELSE to_char(sret.return_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END`
  },
  client_created_date: {
    label: "Дата создания клиента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`
  },
  client_created_year: {
    label: "Дата создания клиента.Год",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`EXTRACT(YEAR FROM c.created_at AT TIME ZONE 'UTC')::int::text`
  },
  client_created_month: {
    label: "Дата создания клиента.Месяц",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`EXTRACT(MONTH FROM c.created_at AT TIME ZONE 'UTC')::int::text`
  },
  client_created_day: {
    label: "Дата создания клиента.День",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`EXTRACT(DAY FROM c.created_at AT TIME ZONE 'UTC')::int::text`
  },
  order_debt_display: {
    label: "Долг по заказу",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`(GREATEST(o.total_sum - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.order_id = o.id AND pa.tenant_id = o.tenant_id), 0::decimal), 0::decimal))::numeric(15,2)::text`
  },
  client_balance_display: {
    label: "Баланс",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(cb.balance, 0::numeric)::numeric(15,2)::text`
  },
  /** Bonus mahsulot miqdori (dona) — qiymat (Σ), Значения zonasiga. */
  bonus_qty: {
    label: "Бонусы",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`(CASE WHEN oi.is_bonus THEN oi.qty ELSE 0 END)::numeric(15,3)::text`
  },
  /** Bonus qatorida berilgan mahsulot nomi; oddiy qatorda bo‘sh. */
  is_bonus: {
    label: "Бонус",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`(CASE WHEN oi.is_bonus THEN COALESCE(NULLIF(TRIM(p.name), ''), '') ELSE '' END)`
  }
};
