/**
 * Tarix/audit yozuvlarini oddiy odam tushunadigan ko'rinishga o'giradi.
 * Texnik kodlar (`patch.bonus_stack`, `permissions.updated`, `period_return`)
 * o'rniga rus tilidagi tushunarli matn va xom JSON o'rniga qisqa xulosa.
 */

/** entity_type → tushunarli nom (RU). */
export const ENTITY_TYPE_LABEL: Record<string, string> = {
  order: "Заказ",
  client: "Клиент",
  user: "Сотрудник",
  staff: "Сотрудник",
  product: "Товар",
  product_category: "Категория товара",
  product_brand: "Бренд",
  product_manufacturer: "Производитель",
  product_segment: "Сегмент",
  product_catalog_group: "Группа товаров",
  interchangeable_product_group: "Взаимозаменяемая группа",
  product_price: "Цена товара",
  warehouse: "Склад",
  tenant_settings: "Настройки",
  stock: "Остаток на складе",
  bonus_rule: "Бонусное правило",
  goods_receipt: "Поступление",
  supplier: "Поставщик",
  finance: "Оплата",
  payment: "Оплата",
  sales_return: "Возврат",
  expense: "Расход",
  cash_desk: "Касса",
  currency_rate: "Курс валюты",
  territory: "Территория",
  automation_rule: "Правило автоматизации",
  refusal: "Отказ клиента",
  warehouse_block: "Блок склада",
  stock_take: "Инвентаризация",
  price_matrix: "Матрица цен",
  work_slot: "Рабочее место",
  geo_boundary: "Гео-граница",
  report_builder: "Конфиг отчёта",
  client_dedupe: "Группа дублей",
  plans: "Планы"
};

/** action (to'liq kod) → tushunarli nom (RU). */
const ACTION_LABEL: Record<string, string> = {
  // Umumiy
  create: "Создание",
  update: "Изменение",
  delete: "Удаление",
  soft_delete: "Удаление (в архив)",
  patch: "Изменение",
  meta: "Изменение данных",
  sync: "Синхронизация цен",
  reactivate: "Активация",
  deactivate: "Деактивация",
  unassign: "Открепление",
  "create.bulk": "Массовое создание",

  // Оплаты
  "payment.create": "Оплата создана",
  "payment.update": "Оплата изменена",
  "payment.void": "Оплата удалена (в архив)",
  "payment.restore": "Оплата восстановлена",
  "payment.allocate": "Распределение оплаты",
  "payment.confirm_pending": "Оплата подтверждена",
  "payment.reject_pending": "Оплата отклонена",
  "payment.return_to_expeditor": "Возврат экспедитору",

  // Возвраты
  sales_return: "Возврат товара",
  "return.create": "Возврат создан",
  period_return: "Возврат за период",
  full_return: "Полный возврат",
  return_reason: "Причина возврата",

  // Клиент
  "client.create": "Клиент создан",
  "client.patch": "Клиент изменён",
  "client.photo_report_add": "Добавлен фотоотчёт",
  "client.photo_report_delete": "Фотоотчёт удалён",
  "client.photo_report_restore": "Фотоотчёт восстановлен",
  "client.equipment_remove": "Оборудование снято",
  "client.payment": "Оплата клиента",
  "client.payment_void": "Оплата клиента аннулирована",
  "client.payment_restore": "Оплата клиента восстановлена",
  "client.client_expense": "Расход клиента",
  "client.discount_payment": "Оплата скидки",
  "client.sales_return": "Возврат клиента",
  "client.import.create": "Клиент создан (импорт)",
  "client.import.patch": "Клиент изменён (импорт)",
  "client.tags.patch": "Теги клиента изменены",
  "client.merge": "Объединение клиентов",
  "client.merge.undo": "Отмена объединения клиентов",

  // Поставщики
  "supplier.create": "Поставщик создан",
  "supplier.update": "Поставщик изменён",
  "supplier.delete": "Поставщик удалён",
  "supplier.void": "Поставщик деактивирован",
  "supplier.restore": "Поставщик восстановлен",
  "supplier_payment.create": "Оплата поставщику создана",
  "supplier_payment.reverse": "Оплата поставщику отменена",

  // Расходы
  "expense.create": "Расход создан",
  "expense.void": "Расход удалён",
  "expense.restore": "Расход восстановлен",
  "expense.approve": "Расход утверждён",
  "expense.reject": "Расход отклонён",

  // Склад / перемещения / поступления
  transfer_create: "Перемещение создано",
  transfer_update: "Перемещение изменено",
  transfer_start: "Перемещение начато",
  transfer_receive: "Перемещение принято",
  transfer_cancel: "Перемещение отменено",
  "warehouse_correction.bulk": "Корректировка склада",

  // Импорт
  "import.xlsx": "Импорт из Excel",
  "import.xlsx.postupleniya2": "Импорт поступлений (Excel)",
  "import.catalog_xlsx": "Импорт каталога (Excel)",
  "import.catalog_update_only": "Импорт каталога (обновление)",

  // Цены / бонусы
  "bulk.matrix": "Массовое изменение цен",
  "schedule.matrix": "Плановое изменение цен",
  "patch.active": "Изменение статуса (вкл/выкл)",
  "patch.bonus_stack": "Изменение бонусных настроек",
  update_order_scope: "Изменение области заказа",

  // Консигнация
  "bulk.consignation": "Массовая консигнация",
  "bulk.consignation_rows": "Массовая консигнация (строки)",

  // Касса
  "cash_desk.create": "Касса создана",
  "cash_desk.update": "Касса изменена",
  "cash_desk.shift_open": "Смена открыта",
  "cash_desk.shift_close": "Смена закрыта",

  // Курсы валют
  "currency_rate.create": "Курс добавлен",
  "currency_rate.update": "Курс изменён",
  "currency_rate.delete": "Курс удалён",
  "currency_rate.void": "Курс удалён (в архив)",
  "currency_rate.restore": "Курс восстановлен",

  // Территории
  "territory.create": "Территория создана",
  "territory.update": "Территория изменена",
  "territory.delete": "Территория удалена",
  "territory.restore": "Территория восстановлена",
  "territory.assign": "Сотрудник назначен на территорию",
  "territory.unassign": "Сотрудник снят с территории",

  // Автоматизация заказов
  "automation_rule.create": "Правило создано",
  "automation_rule.update": "Правило изменено",
  "automation_rule.delete": "Правило удалено",
  "automation_rule.void": "Правило удалено (в архив)",
  "automation_rule.restore": "Правило восстановлено",
  "automation_rule.copy": "Правило скопировано",

  // Отказы
  "refusal.create": "Отказ зафиксирован",

  // Блоки склада
  "warehouse_block.create": "Блок склада создан",
  "warehouse_block.update": "Блок склада изменён",
  "warehouse_block.delete": "Блок склада удалён",
  "warehouse_block.void": "Блок склада удалён (в архив)",
  "warehouse_block.restore": "Блок склада восстановлен",
  "warehouse_block.confirm_empty": "Блок подтверждён пустым",
  "warehouse.void": "Склад деактивирован",
  "warehouse.restore": "Склад восстановлен",

  // Инвентаризация
  "stock_take.create": "Инвентаризация создана",
  "stock_take.post": "Инвентаризация проведена",
  "stock_take.cancel": "Инвентаризация отменена",

  // Матрица цен
  "price_matrix.bulk_upsert": "Массовое изменение цен (матрица)",
  "price_matrix.apply_category": "Цены применены к категории",

  // Сотрудники
  "patch.agent": "Изменение агента",
  "patch.expeditor": "Изменение экспедитора",
  "patch.collector": "Изменение инкассатора",
  "patch.auditor": "Изменение аудитора",
  "patch.supervisor": "Изменение супервайзера",
  "patch.operator": "Изменение оператора",
  "patch.skladchik": "Изменение складовщика",
  "patch.label": "Изменение названия",
  "patch.profile": "Изменение профиля",
  "agents.bulk": "Массовое изменение сотрудников",
  "sessions.revoke": "Сброс сессий",
  revoke_sessions: "Сброс сессий",

  // Доступ
  "permissions.updated": "Изменение прав доступа",
  "permissions.bulk_updated": "Массовое изменение прав",
  "access.reset": "Сброс прав доступа",
  "access.reset_restore": "Восстановление прав после сброса",
  "access.cloned": "Копирование прав доступа",

  // Заказ
  status_change: "Изменение статуса",
  "order.create": "Заказ создан",
  "order.status": "Изменение статуса заказа",
  "order.cancel": "Заказ отменён",
  "order.meta": "Изменение данных заказа",

  // Рабочее место / гео / отчёты
  "work_slot.create": "Рабочее место создано",
  "work_slot.update": "Рабочее место изменено",
  "work_slot.void": "Рабочее место удалено",
  "work_slot.restore": "Рабочее место восстановлено",
  "geo_boundary.upsert": "Гео-граница сохранена",
  "geo_boundary.delete": "Гео-граница удалена",
  "geo_boundary.void": "Гео-граница удалена (в архив)",
  "geo_boundary.restore": "Гео-граница восстановлена",
  "report_builder.delete": "Конфиг отчёта удалён",
  "report_builder.void": "Конфиг отчёта удалён (в архив)",
  "report_builder.restore": "Конфиг отчёта восстановлен",
  "client_dedupe.void": "Группа дублей удалена (в архив)",
  "client_dedupe.restore": "Группа дублей восстановлена",
  "plans.approvers.save": "Утверждающие планов сохранены",

  // Табель
  "timesheet.patch.attendance": "Изменение посещаемости",

  // Прочее
  offline_enqueue: "Офлайн-операция"
};

/** Foydalanuvchi xatti-harakatlari (UserActivityEvent.event_type). */
const EVENT_TYPE_LABEL: Record<string, string> = {
  page_view: "Просмотр страницы",
  navigation: "Переход",
  view_intent: "Просмотр",
  form_open: "Открыл форму",
  form_abandon: "Закрыл без сохранения"
};

/** action kodini tushunarli matnga o'giradi (mos kelmasa — aqlli fallback). */
export function humanizeAction(action: string | null | undefined): string {
  if (!action) return "—";
  if (EVENT_TYPE_LABEL[action]) return EVENT_TYPE_LABEL[action];
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];

  const a = action.toLowerCase();
  if (a.startsWith("import")) return "Импорт";
  if (a.includes("create") || a.includes("generat") || a.includes("dobav")) return "Создание";
  if (a.includes("delete") || a.includes("void") || a.includes("udal")) return "Удаление";
  if (a.includes("restore")) return "Восстановление";
  if (a.includes("approve") || a.includes("confirm") || a.includes("utverzh")) return "Подтверждение";
  if (a.includes("reject") || a.includes("cancel") || a.includes("otmen")) return "Отмена/отклонение";
  if (a.includes("status")) return "Изменение статуса";
  if (a.includes("return") || a.includes("vozvrat")) return "Возврат";
  if (a.includes("payment") || a.includes("oplat")) return "Оплата";
  if (a.includes("patch") || a.includes("update") || a.includes("izmen")) return "Изменение";
  // So'nggi chora: kodni o'qiladigan ko'rinishga keltirish
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** entity_type + id → "Заказ #123" ko'rinishi. */
export function humanizeEntity(
  entityType: string | null | undefined,
  entityId?: string | number | null
): string {
  const label = entityType ? ENTITY_TYPE_LABEL[entityType] ?? entityType : "Объект";
  if (entityId == null || entityId === "") return label;
  return `${label} #${entityId}`;
}

/** Payload kalitlari → tushunarli nom. */
const PAYLOAD_KEY_LABEL: Record<string, string> = {
  name: "название",
  number: "номер",
  amount: "сумма",
  refund: "сумма возврата",
  payment_type: "тип оплаты",
  client_id: "клиент (ID)",
  order_id: "заказ (ID)",
  return_id: "возврат (ID)",
  payment_id: "оплата (ID)",
  warehouse_id: "склад (ID)",
  cash_desk_id: "касса (ID)",
  agent_id: "агент (ID)",
  expeditor_user_id: "экспедитор (ID)",
  ledger_agent_id: "агент учёта (ID)",
  supplier_id: "поставщик (ID)",
  product_id: "товар (ID)",
  user_id: "пользователь (ID)",
  target_user_id: "сотрудник (ID)",
  role_id: "роль (ID)",
  entry_kind: "вид",
  line_count: "позиций",
  from_status: "было",
  to_status: "стало",
  type: "тип",
  types: "типы",
  role: "роль",
  login: "логин",
  mode: "режим",
  reason: "причина",
  comment: "комментарий",
  count: "кол-во",
  code: "код",
  keys: "права",
  permission: "право",
  permissions: "права",
  duration_minutes: "длительность (мин)",
  soft: "мягкое удаление",
  schedule: "расписание"
};

/** Kalitni tushunarli nomga o'giradi (mos kelmasa — o'qiladigan ko'rinish). */
export function humanizeKey(key: string): string {
  return PAYLOAD_KEY_LABEL[key] ?? key.replace(/[._]/g, " ");
}

function formatScalar(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "да" : "нет";
  return String(value);
}

export type PayloadRow = { label: string; value: string };

/**
 * Payload'ning BARCHA maydonlarini batafsil, tushunarli ko'rinishda qaytaradi
 * (ID/nomer/tip — hammasi to'liq). Drawer'dagi "Детали" uchun.
 */
export function payloadDetailRows(payload: unknown): PayloadRow[] {
  if (payload == null || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const rows: PayloadRow[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === "") continue;
    let text: string;
    if (Array.isArray(v)) {
      text = v.length === 0 ? "—" : v.map((x) => formatScalar(x)).join(", ");
    } else if (typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, vv]) => vv != null);
      text = entries.length
        ? entries.map(([kk, vv]) => `${humanizeKey(kk)}: ${formatScalar(vv)}`).join("; ")
        : "—";
    } else if (k === "entry_kind" && typeof v === "string") {
      text = ENTRY_KIND_LABEL[v] ?? v;
    } else {
      text = formatScalar(v);
    }
    rows.push({ label: humanizeKey(k), value: text });
  }
  return rows;
}

const ENTRY_KIND_LABEL: Record<string, string> = {
  payment: "оплата",
  client_expense: "расход клиента",
  discount_settlement: "оплата скидки"
};

function valueToText(key: string, value: unknown): string | null {
  if (value == null || value === "") return null;
  if (key === "entry_kind" && typeof value === "string") return ENTRY_KIND_LABEL[value] ?? value;
  if (Array.isArray(value)) return value.length ? `${value.length}` : null;
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return keys.length ? keys.join(", ") : null;
  }
  if (typeof value === "boolean") return value ? "да" : "нет";
  const s = String(value);
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

/**
 * Payload'dan qisqa, tushunarli xulosa: "статус: новый → собран", "сумма: 50 000".
 * Hech narsa topilmasa bo'sh string.
 */
export function summarizePayload(payload: unknown): string {
  if (payload == null || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;

  // Status o'zgarishi maxsus ko'rinish
  if (obj.from_status != null || obj.to_status != null) {
    const parts: string[] = [];
    if (obj.to_status != null) parts.push(`статус: ${obj.from_status ?? "—"} → ${obj.to_status}`);
    return parts.join(", ");
  }

  // `patch` — qaysi maydonlar o'zgargani
  if (obj.patch && typeof obj.patch === "object" && !Array.isArray(obj.patch)) {
    const fields = Object.keys(obj.patch as object);
    if (fields.length) {
      const named = fields.map((f) => PAYLOAD_KEY_LABEL[f] ?? f).slice(0, 5);
      return `изменено: ${named.join(", ")}${fields.length > 5 ? "…" : ""}`;
    }
  }

  const priority = [
    "number",
    "name",
    "amount",
    "refund",
    "payment_type",
    "entry_kind",
    "order_id",
    "client_id",
    "line_count",
    "role",
    "login",
    "reason"
  ];
  const out: string[] = [];
  for (const k of priority) {
    if (k in obj) {
      const txt = valueToText(k, obj[k]);
      if (txt != null) out.push(`${PAYLOAD_KEY_LABEL[k] ?? k}: ${txt}`);
    }
    if (out.length >= 4) break;
  }
  return out.join(", ");
}
