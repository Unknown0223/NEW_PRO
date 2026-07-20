import { Prisma } from "@prisma/client";
import { DATASET_ORDERS_SALES_LINES } from "./report-builder.constants";
import type {
  ReportBuilderDateMode,
  ReportBuilderFieldMeta,
  ReportBuilderMetadataResponse,
  ReportBuilderWdrFieldMeta
} from "./report-builder.types";

/** Faqat registry kalitlari — tashqi ID SQLga kiritilmaydi. */

export const FIELD_REGISTRY_PART1: Record<
  string,
  { label: string; allowRow: boolean; allowCol: boolean; expr: () => import("@prisma/client").Prisma.Sql }
> = {
  client_name: {
    label: "Клиент",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.name, '')`
  },
  client_category: {
    label: "Категория клиента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.category, '')`
  },
  client_zone: {
    label: "Зона",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.zone, '')`
  },
  client_region: {
    label: "Область",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.region, '')`
  },
  client_city: {
    label: "Город",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.city, '')`
  },
  agent_name: {
    label: "Агент",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(agent.name, '')`
  },
  agent_branch: {
    label: "Дилер",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(NULLIF(TRIM(agent.branch), ''), '')`
  },
  agent_code: {
    label: "Код агента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(agent.code, '')`
  },
  work_slot_code: {
    label: "Рабочее место (код)",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(agent_ws.slot_code, '')`
  },
  supervisor_name: {
    label: "Супервайзер",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(sup.name, '')`
  },
  supervisor_code: {
    label: "Код супервизора",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(sup.code, '')`
  },
  expeditor_name: {
    label: "Экспедитор",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(exp.name, '')`
  },
  warehouse_name: {
    label: "Склад",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(w.name, '')`
  },
  warehouse_code: {
    label: "Код склада",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(w.code, '')`
  },
  product_name: {
    label: "Продукт",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(p.name, '')`
  },
  product_sku: {
    label: "ИД Продукта",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(p.sku, '')`
  },
  product_sell_code: {
    label: "Штрихкод / sell-код",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(p.sell_code, '')`
  },
  category_name: {
    label: "Категория товара",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(pc.name, '')`
  },
  brand_name: {
    label: "Бренд",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(pb.name, '')`
  },
  order_status: {
    label: "Статус",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(o.status, '')`
  },
  order_number: {
    label: "ИД заявки",
    allowRow: true,
    allowCol: false,
    expr: () => Prisma.sql`COALESCE(o.number, '')`
  },
  order_type: {
    label: "Тип",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(o.order_type, '')`
  },
  trade_direction: {
    label: "Направление торговли",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(td.name, COALESCE(agent.trade_direction, ''))`
  },
  order_id: {
    label: "Заказ ID",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`o.id::text`
  },
  client_id_display: {
    label: "Клиент ID",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`c.id::text`
  },
  client_code: {
    label: "ИД клиента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.client_code, '')`
  },
  client_address: {
    label: "Адрес клиента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.address, '')`
  },
  client_landmark: {
    label: "Ориентир клиента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.landmark, '')`
  },
  client_legal_name: {
    label: "Юр. наз. клиента",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.legal_name, '')`
  },
  client_gps: {
    label: "Координаты клиента",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`TRIM(BOTH ' ' FROM CONCAT(COALESCE(c.latitude::text, ''), ' ', COALESCE(c.longitude::text, '')))`
  },
  sales_channel: {
    label: "Канал продаж",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.sales_channel, '')`
  },
  territory_level_1: {
    label: "Зона",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.zone, '')`
  },
  territory_level_2: {
    label: "Область",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.region, '')`
  },
  territory_level_3: {
    label: "Город",
    allowRow: true,
    allowCol: true,
    expr: () => Prisma.sql`COALESCE(c.city, '')`
  },
  tenant_default_currency: {
    label: "Валюта по умолчанию",
    allowRow: true,
    allowCol: true,
    expr: () =>
      Prisma.sql`COALESCE(NULLIF(TRIM(tnt.settings::jsonb #>> '{references,currency_entries,0,currency_code}'), ''), 'UZS')`
  },
};
