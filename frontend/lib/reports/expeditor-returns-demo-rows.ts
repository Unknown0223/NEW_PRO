/**
 * Namuna qatorlar — «Возврат экспедитора» jadvalida barcha ko‘rinadigan ustunlarni tekshirish uchun.
 * Sahifada «Демо-строки» tugmasi yoqilganda API qatorlarining ustiga qo‘shiladi (order_id / product_id manfiy).
 * Konsolga chiqarish: `npm run report:expeditor-demo-print` (frontend papkasida).
 */

export type DemoOrderRow = {
  row_number: number;
  order_id: number;
  order_number: string;
  order_type_label: string;
  status_label: string;
  order_date: string;
  shipped_at: string | null;
  delivered_at: string | null;
  client_name: string;
  agent_label: string;
  expeditor_label: string;
  qty_ordered: string;
  qty_returned: string;
  qty_bonus_ordered: string;
  qty_bonus_returned: string;
  qty_delivered: string;
  sum_before: string;
  sum_after: string;
  sum_return: string;
  updated_at: string;
  reason_agent: string;
  reason_expeditor: string;
};

export type DemoAggRow = {
  row_number: number;
  client_id?: number;
  client_name?: string;
  product_id: number;
  category_name: string;
  product_name: string;
  sku: string;
  qty_ordered: string;
  qty_returned: string;
  qty_bonus_ordered: string;
  qty_bonus_returned: string;
  qty_delivered: string;
  qty_return_warehouse: string;
};

const iso = (d: string, t = "12:00:00") => `${d}T${t}.000Z`;

export const DEMO_EXPEDITOR_ORDER_ROWS: DemoOrderRow[] = [
  {
    row_number: 1,
    order_id: -910001,
    order_number: "DEMO-Z-1001",
    order_type_label: "Обычная продажа",
    status_label: "Доставлен",
    order_date: iso("2026-04-01"),
    shipped_at: iso("2026-04-02", "09:30:00"),
    delivered_at: iso("2026-04-03", "14:15:00"),
    client_name: 'ООО «Демо-Клиент А»',
    agent_label: "Агентов П. (AG-D1)",
    expeditor_label: "Эксп. Сидоров (EX-D1)",
    qty_ordered: "120",
    qty_returned: "12",
    qty_bonus_ordered: "4",
    qty_bonus_returned: "1",
    qty_delivered: "108",
    sum_before: "12500000",
    sum_after: "11375000",
    sum_return: "1125000",
    updated_at: iso("2026-04-04", "10:00:00"),
    reason_agent: "Пересорт (демо)",
    reason_expeditor: "Брак упаковки (демо)"
  },
  {
    row_number: 2,
    order_id: -910002,
    order_number: "DEMO-Z-1002",
    order_type_label: "Консигнация",
    status_label: "Частично доставлен",
    order_date: iso("2026-04-05"),
    shipped_at: iso("2026-04-06", "08:00:00"),
    delivered_at: null,
    client_name: 'ИП «Демо Б»',
    agent_label: "Ким В. (AG-D2)",
    expeditor_label: "Эксп. Ли (EX-D2)",
    qty_ordered: "60",
    qty_returned: "60",
    qty_bonus_ordered: "0",
    qty_bonus_returned: "0",
    qty_delivered: "0",
    sum_before: "4800000",
    sum_after: "0",
    sum_return: "4800000",
    updated_at: iso("2026-04-07", "16:45:00"),
    reason_agent: "Отказ клиента",
    reason_expeditor: "Возврат на склад"
  },
  {
    row_number: 3,
    order_id: -910003,
    order_number: "DEMO-Z-1003",
    order_type_label: "Обычная продажа",
    status_label: "Новый",
    order_date: iso("2026-04-10"),
    shipped_at: null,
    delivered_at: null,
    client_name: "ЧП «Демо В»",
    agent_label: "Нурматов Д.",
    expeditor_label: "—",
    qty_ordered: "24",
    qty_returned: "0",
    qty_bonus_ordered: "2",
    qty_bonus_returned: "0",
    qty_delivered: "0",
    sum_before: "3600000",
    sum_after: "3600000",
    sum_return: "0",
    updated_at: iso("2026-04-10", "11:20:00"),
    reason_agent: "",
    reason_expeditor: ""
  }
];

export const DEMO_EXPEDITOR_PRODUCT_ROWS: DemoAggRow[] = [
  {
    row_number: 1,
    product_id: -920001,
    category_name: "Напитки",
    product_name: "Демо-товар «Кола» 0,5",
    sku: "SKU-DEMO-01",
    qty_ordered: "500",
    qty_returned: "48",
    qty_bonus_ordered: "10",
    qty_bonus_returned: "2",
    qty_delivered: "452",
    qty_return_warehouse: "46"
  },
  {
    row_number: 2,
    product_id: -920002,
    category_name: "Снеки",
    product_name: "Демо-товар «Чипсы» 150г",
    sku: "SKU-DEMO-02",
    qty_ordered: "200",
    qty_returned: "200",
    qty_bonus_ordered: "0",
    qty_bonus_returned: "0",
    qty_delivered: "0",
    qty_return_warehouse: "200"
  },
  {
    row_number: 3,
    product_id: -920003,
    category_name: "Бытовая химия",
    product_name: "Демо «Порошок» 3кг",
    sku: "SKU-DEMO-03",
    qty_ordered: "80",
    qty_returned: "5",
    qty_bonus_ordered: "4",
    qty_bonus_returned: "0",
    qty_delivered: "75",
    qty_return_warehouse: "5"
  }
];

export const DEMO_EXPEDITOR_CLIENT_ROWS: DemoAggRow[] = [
  {
    row_number: 1,
    client_id: -930001,
    client_name: 'ООО «Демо-Клиент А»',
    product_id: 88001,
    category_name: "Напитки",
    product_name: "Вода 1,5л",
    sku: "SKU-CL-D1",
    qty_ordered: "300",
    qty_returned: "30",
    qty_bonus_ordered: "6",
    qty_bonus_returned: "1",
    qty_delivered: "270",
    qty_return_warehouse: "29"
  },
  {
    row_number: 2,
    client_id: -930002,
    client_name: 'ИП «Демо Б»',
    product_id: 88002,
    category_name: "Снеки",
    product_name: "Батончик",
    sku: "SKU-CL-D2",
    qty_ordered: "150",
    qty_returned: "150",
    qty_bonus_ordered: "0",
    qty_bonus_returned: "0",
    qty_delivered: "0",
    qty_return_warehouse: "150"
  },
  {
    row_number: 3,
    client_id: -930001,
    client_name: 'ООО «Демо-Клиент А»',
    product_id: 88003,
    category_name: "Молочка",
    product_name: "Йогурт 400г",
    sku: "SKU-CL-D3",
    qty_ordered: "90",
    qty_returned: "6",
    qty_bonus_ordered: "0",
    qty_bonus_returned: "0",
    qty_delivered: "84",
    qty_return_warehouse: "6"
  }
];
