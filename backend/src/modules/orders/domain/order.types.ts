/** Orders domain — shared types and Prisma include. */
import { Prisma } from "@prisma/client";
import type { AppliedBonusRuleSnapshot } from "../../bonus-rules/bonus-rules.snapshot";

export type OrderLineInput = { product_id: number; qty: number };

export type BonusGiftOverrideInput = {
  bonus_rule_id: number;
  bonus_product_id: number;
};

/** Qty bonus: bir qoida bo‘yicha bir nechta sovg‘a mahsuloti va dona. */
export type BonusGiftLineInput = {
  bonus_rule_id: number;
  product_id: number;
  qty: number;
};

export type CreateOrderInput = {
  client_id: number;
  /** Majburiy — qaysi ombordan jo’natiladi */
  warehouse_id: number;
  agent_id?: number | null;
  /** Savdo zakazida majburiy: to‘lov usuli (spravochnik) */
  payment_method_ref?: string | null;
  /** `null` — avto tanlov yo’q; `undefined` — avtobog’lash */
  expeditor_user_id?: number | null;
  /** Bo’sh bo’lsa `retail` */
  price_type?: string | null;
  /** Hujjat tipi: order | return | exchange | partial_return | return_by_order */
  order_type?: string | null;
  apply_bonus?: boolean;
  /** `false` — chegirma qo‘llanmaydi (bonus yoqilgan bo‘lsa ham). */
  apply_discount?: boolean;
  /** Qty bonus: `bonus_product_ids` ro‘yxatidan tanlov (faqat qoida ro‘yxatida bor mahsulotlar) */
  bonus_gift_overrides?: BonusGiftOverrideInput[];
  /** Qty bonus: bir qoida uchun bir nechta mahsulot/dona (mobil assortiment tanlovi). */
  bonus_gift_lines?: BonusGiftLineInput[];
  comment?: string | null;
  /** Sozlamalar → request_type_entries (kod yoki nom, max 128) */
  request_type_ref?: string | null;
  /** Konsignatsiya zakazi — agent limiti tekshiriladi */
  is_consignment?: boolean;
  /** ISO sana (ixtiyoriy) */
  consignment_due_date?: string | null;
  items: OrderLineInput[];
  /** `order_type=exchange` uchun majburiy (minus/plus alohida) */
  source_order_ids?: number[];
  minus_lines?: Array<{ order_id: number; product_id: number; qty: number }>;
  plus_lines?: Array<{ product_id: number; qty: number }>;
  reason_ref?: string | null;
};

export type UpdateOrderLinesInput = {
  items: OrderLineInput[];
  warehouse_id?: number | null;
  agent_id?: number | null;
  /** Savdo zakazida saqlangan to‘lov usulini yangilash (ixtiyoriy) */
  payment_method_ref?: string | null;
  apply_bonus?: boolean;
  bonus_gift_overrides?: BonusGiftOverrideInput[];
};

export type OrderItemRow = {
  id: number;
  product_id: number;
  sku: string;
  name: string;
  qty: string;
  price: string;
  total: string;
  is_bonus: boolean;
  /** `exchange` zakazlarida */
  exchange_line_kind?: string | null;
  /** Mahsulot birlik hajmi (m³), bo‘sh bo‘lsa UI «—» */
  volume_m3: string | null;
  weight_kg: string | null;
  /** qty × volume_m3 */
  line_volume_m3: string | null;
  /** qty × weight_kg */
  line_weight_kg: string | null;
  /** (price×qty − total) / (price×qty) × 100, bonus yoki nol bo‘lsa null yoki «0.00» */
  discount_pct: string | null;
  /** Guruh / katalog kategoriyasi (ro‘yxat expand). */
  category_id: number | null;
  category_name: string | null;
  /** Berilgan bonus mahsulot nomi (pullik qator uchun). */
  bonus_product_name?: string | null;
  /** Berilgan bonus miqdori (dona). */
  bonus_product_qty?: string | null;
  /** Bonus sababi: bitta trigger nomi yoki «Аралаш (…)». */
  bonus_trigger_label?: string | null;
};

export type OrderListRow = {
  id: number;
  number: string;
  order_type: string | null;
  client_id: number;
  client_name: string;
  /** Smart-kod (client_code). */
  client_code: string | null;
  client_legal_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  agent_id: number | null;
  agent_name: string | null;
  agent_code: string | null;
  /** Agent savdo yo‘nalishi (ro‘yxat / polki tanlash) */
  agent_trade_direction: string | null;
  expeditors: string | null;
  expeditor_id: number | null;
  expeditor_display: string | null;
  region: string | null;
  city: string | null;
  zone: string | null;
  consignment: boolean | null;
  /** Zakaz konsignatsiyasi (order.is_consignment). */
  is_consignment: boolean;
  day: string | null;
  created_by: string | null;
  created_by_role: string | null;
  expected_ship_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  status: string;
  qty: string;
  total_sum: string;
  /** Bonus mahsulotlar bo‘yicha jami dona (ro‘yxat «Bonus» ustuni) */
  bonus_qty: string;
  /** Foizli chegirma summasi */
  discount_sum: string;
  /** Vozvrat: «Долг скидка» izohi */
  discount_debt_note?: string | null;
  /** Skidka kutilgan, lekin qo‘llanmagan */
  discount_alert?: string | null;
  /** Bonus yetarli emas */
  bonus_alert?: string | null;
  /** Bonus mahsulotlarning narxlangan qiymati (ichki hisob) */
  bonus_sum: string;
  balance: string | null;
  debt: string | null;
  price_type: string | null;
  comment: string | null;
  /** «Причины заявок» tanlovi */
  request_type_ref: string | null;
  client_phone: string | null;
  client_inn: string | null;
  client_address: string | null;
  order_location: string | null;
  sales_channel: string | null;
  volume_m3: string | null;
  cumulative_bonus: string | null;
  consignment_due_date: string | null;
  source_order_numbers: string[];
  source_order_ids: number[];
  returned_at: string | null;
  /** `web` — ofis/operator; `mobile` — agent ilovasi */
  creation_channel: "web" | "mobile";
  created_at: string;
  /** Yaratilgan vaqt (ustun «Дата создания»). */
  list_created_at: string | null;
  /** Yig‘ish: zakaz qaysi «доставщик bloki»da turishi (skladchi belgilaydi). */
  warehouse_block_id: number | null;
  warehouse_block_name: string | null;
  /** Joriy foydalanuvchi roli uchun ruxsat etilgan keyingi holatlar (jadvalda tez o‘zgartirish). */
  allowed_next_statuses: string[];
  /** Buyurtma tasdiqlash zanjiri holati (detail API). */
  approval_status?: string | null;
};

export type OrderStatusLogRow = {
  id: number;
  from_status: string;
  to_status: string;
  user_login: string | null;
  created_at: string;
};

export type OrderChangeLogRow = {
  id: number;
  action: string;
  payload: unknown;
  user_login: string | null;
  created_at: string;
};

export type BonusGiftSwapOptionRow = {
  bonus_rule_id: number;
  rule_name: string;
  allowed_product_ids: number[];
  chosen_product_id: number;
  products: Array<{ id: number; name: string; sku: string }>;
};

export type OrderDetailRow = OrderListRow & {
  agent_id: number | null;
  warehouse_name: string | null;
  agent_display: string | null;
  /** Agent savdo yo‘nalishi (User.trade_direction yoki spravochnik nomi) */
  agent_trade_direction: string | null;
  /** Savdo zakazida tanlangan to‘lov usuli */
  payment_method_ref: string | null;
  /** Spravochnik bo‘yicha o‘qiladigan nom (vedoma «Способ оплаты» bilan bir xil) */
  payment_method_label: string | null;
  is_consignment: boolean;
  consignment_due_date: string | null;
  apply_bonus: boolean;
  items: OrderItemRow[];
  allowed_next_statuses: string[];
  status_logs: OrderStatusLogRow[];
  change_logs: OrderChangeLogRow[];
  /** Saqlangan qty bonus sovg‘a tanlovlari (rule_id string kalit) */
  bonus_gift_selections?: Record<string, number>;
  /** UI: bir nechta sovg‘a varianti bo‘lgan qo‘llangan qty qoidalar */
  bonus_gift_swap_options?: BonusGiftSwapOptionRow[];
  /** Qo‘llangan qoidalar snapshot (zakaz yaratilganda / qatorlar yangilanganda) */
  applied_bonus_rules_snapshot?: AppliedBonusRuleSnapshot[];
  /** Faqat yaratish javobida (ixtiyoriy) */
  client_finance?: {
    account_balance: string;
    credit_limit: string;
    outstanding: string;
    headroom: string;
  };
  /** Mijoz tafsiloti (detail) */
  client_category: string | null;
  client_responsible_person: string | null;
  /** Mijoz GPS (tafsilot sahifasi) */
  client_gps_text: string | null;
  client_latitude: string | null;
  client_longitude: string | null;
};

export type UpdateOrderMetaInput = {
  warehouse_id?: number | null;
  agent_id?: number | null;
  /** Qo‘lda biriktirish yoki `null` — avto tanlovni bekor qilish */
  expeditor_user_id?: number | null;
  comment?: string | null;
  payment_method_ref?: string | null;
  /** Skladchi: zakazni qaysi blokka qo‘ygani (`null` — blokdan yechish). */
  warehouse_block_id?: number | null;
};

export const orderDetailInclude: Prisma.OrderInclude = {
  client: {
    select: {
      name: true,
      legal_name: true,
      client_code: true,
      phone: true,
      inn: true,
      address: true,
      landmark: true,
      sales_channel: true,
      region: true,
      city: true,
      district: true,
      neighborhood: true,
      category: true,
      responsible_person: true,
      gps_text: true,
      latitude: true,
      longitude: true
    }
  },
  warehouse: { select: { id: true, name: true } },
  warehouse_block: { select: { id: true, name: true, warehouse_id: true, is_active: true } },
  agent: {
    select: {
      id: true,
      login: true,
      name: true,
      code: true,
      consignment: true,
      trade_direction: true,
      trade_direction_row: { select: { name: true, code: true } }
    }
  },
  expeditor_user: { select: { id: true, login: true, name: true, code: true } },
  items: {
    orderBy: { id: "asc" },
    include: {
      product: {
        select: {
          sku: true,
          name: true,
          volume_m3: true,
          weight_kg: true,
          category_id: true,
          category: { select: { id: true, name: true } },
          product_group: { select: { id: true, name: true } }
        }
      }
    }
  },
  /** So‘nggi yozuvlar (UI da eski → yangi tartibda). */
  status_logs: {
    orderBy: { created_at: "desc" },
    take: 100,
    include: { user: { select: { login: true } } }
  },
  change_logs: {
    orderBy: { created_at: "desc" },
    take: 100,
    include: { user: { select: { login: true } } }
  }
};

/** `orderDetailInclude` bilan yuklangan zakaz. */
export type OrderDetailLoaded = {
  id: number;
  number: string;
  client_id: number;
  warehouse_id: number | null;
  agent_id: number | null;
  expeditor_user_id: number | null;
  status: string;
  approval_status: string | null;
  approval_step: number;
  total_sum: Prisma.Decimal;
  bonus_sum: Prisma.Decimal;
  discount_sum: Prisma.Decimal;
  applied_auto_bonus_rule_ids: number[];
  applied_bonus_rules_snapshot?: Prisma.JsonValue | null;
  bonus_gift_selections?: Prisma.JsonValue | null;
  comment: string | null;
  request_type_ref: string | null;
  order_type: string;
  is_consignment: boolean;
  consignment_due_date: Date | null;
  payment_method_ref: string | null;
  warehouse_block_id: number | null;
  discount_alert: string | null;
  bonus_alert: string | null;
  created_at: Date;
  client: {
    name: string;
    legal_name: string | null;
    client_code: string | null;
    phone: string | null;
    inn: string | null;
    address: string | null;
    landmark: string | null;
    sales_channel: string | null;
    region: string | null;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    category: string | null;
    responsible_person: string | null;
    gps_text: string | null;
    latitude: Prisma.Decimal | null;
    longitude: Prisma.Decimal | null;
  };
  warehouse: { id: number; name: string } | null;
  warehouse_block: { id: number; name: string; warehouse_id: number; is_active: boolean } | null;
  agent: {
    id: number;
    login: string;
    name: string;
    code: string | null;
    consignment: boolean;
    trade_direction: string | null;
    trade_direction_row: { name: string; code: string | null } | null;
  } | null;
  expeditor_user: { id: number; login: string; name: string; code: string | null } | null;
  items: Array<{
    id: number;
    product_id: number;
    qty: Prisma.Decimal;
    price: Prisma.Decimal;
    total: Prisma.Decimal;
    is_bonus: boolean;
    exchange_line_kind: string | null;
    product: {
      sku: string;
      name: string;
      volume_m3: Prisma.Decimal | null;
      weight_kg: Prisma.Decimal | null;
      category_id: number | null;
      category: { id: number; name: string } | null;
      product_group: { id: number; name: string } | null;
    };
  }>;
  status_logs: Array<{
    id: number;
    from_status: string;
    to_status: string;
    created_at: Date;
    user: { login: string } | null;
  }>;
  change_logs: Array<{
    id: number;
    action: string;
    payload: Prisma.JsonValue;
    created_at: Date;
    user: { login: string } | null;
  }>;
};

export type ListOrdersQuery = {
  page: number;
  limit: number;
  status?: string;
  client_id?: number;
  /** Raqam, mijoz nomi, izoh bo‘yicha qidiruv */
  search?: string;
  warehouse_id?: number;
  agent_id?: number;
  /** Bir nechta agent (klient profili); `agent_id` bilan bir vaqtda — bu ustun. */
  agent_ids?: number[];
  /** Zakazda agent yo‘q (agent_id IS NULL) */
  include_no_agent?: boolean;
  expeditor_user_id?: number;
  /** Mijoz `category` maydoni bilan to‘liq mos (trim) */
  client_category?: string;
  client_region?: string;
  client_city?: string;
  client_zone?: string;
  /** Agent savdo yo‘nalishi (code yoki name) */
  agent_trade_direction?: string;
  /** Shu mahsulot qatori bo’lgan zakazlar */
  product_id?: number;
  /** YYYY-MM-DD (server vaqt zonasi — brauzer `date` input bilan mos) */
  date_from?: string;
  date_to?: string;
  /**
   * Sana oralig‘i qaysi vaqtga tegishli: `created` | `order` | `ship`.
   * `order` — hozircha `created_at` bilan bir xil (alohida «zakaz sanasi» ustuni yo‘q).
   * `ship` — birinchi marta `delivering` holatiga o‘tgan log vaqti.
   */
  date_mode?: string;
  /** Hujjat tipi bo’yicha filter */
  order_type?: string;
  /** Konsignatsiya zakazlari */
  is_consignment?: boolean;
  /** product.category_id — zakazda shu kategoriyadan mahsulot qatori bo‘lsa */
  product_category_id?: number;
  /** Shu payment_type bo‘lgan to‘lovi bor zakazlar */
  payment_type?: string;
  /** Sozlamalar → request_type_entries (тип накладной) */
  request_type_ref?: string;
  /** Zakazda saqlangan to‘lov usuli (`payment_method_ref`) */
  payment_method_ref?: string;
  /** Jadval «Тип цены» — `payment_method_ref` bilan bir maydon */
  list_price_type?: string;
  /** Mijoz tashrif kuni (1=Пн … 7=Вс) */
  visit_weekday?: number;
  /** Keyset pagination — `next_cursor` dan keyingi sahifa */
  cursor?: string;
  /** Skidka muammosi: not_applied | cash_desk_missing | bonus_required | any */
  discount_alert?: string;
  /** Bonus muammosi: stock_shortage | any */
  bonus_alert?: string;
  /** Har qanday muammo (bonus yoki skidka) */
  order_alert?: string;
};
