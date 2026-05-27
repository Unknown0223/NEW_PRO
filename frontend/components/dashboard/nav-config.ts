export type NavItem = {
  href: string;
  label: string;
  roles?: string[];
  /** Agar berilsa: ushbu permissionlardan kamida bittasi bo‘lsa ham ko‘rinadi (`roles` bilan OR). */
  showIfAnyPermission?: string[];
  disabled?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

/** Dashboard ichki bo'limlari (chap paneldagi ichki menyu) */
export const dashboardHomeNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Дашборды",
  items: [
    { href: "/dashboard", label: "Супервайзер" },
    { href: "/dashboard/finance", label: "Финансы" },
    { href: "/dashboard/sales", label: "Дашборд продаж" },
    { href: "/dashboard/sales-monitoring", label: "Мониторинг продаж и планов" }
  ]
};

/** Rasm (Lalaku-style) bo‘yicha: ombor */
export const dashboardStockNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Склад",
  items: [
    { href: "/stock/warehouses", label: "Склад" },
    { href: "/stock/blocks", label: "Блок склада" },
    { href: "/stock/balances", label: "Остатки товаров" },
    { href: "/stock/recommended", label: "Остатки товара на складе (рекомендованный запас)" },
    { href: "/stock/by-date", label: "Остатки на определенную дату" },
    { href: "/stock/receipts", label: "Поступление" },
    { href: "/stock/receipts-report", label: "Отчёт по приходам" },
    { href: "/stock/transfers", label: "Перемещение товара" },
    { href: "/stock/correction", label: "Корректировка склада", roles: ["admin"] },
    { href: "/stock/material-report", label: "Материальный отчёт" },
    { href: "#", label: "Списание", disabled: true }
  ]
};

/** Заявки — Lalaku: ДЕЙСТВИЯ + УПРАВЛЕНИЕ ЗАКАЗАМИ */
export const dashboardOrdersNav: {
  sectionTitle: string;
  groups: { title: string; items: NavItem[] }[];
} = {
  sectionTitle: "Заявки",
  groups: [
    {
      title: "ДЕЙСТВИЯ",
      items: [
        { href: "/orders/new?type=order", label: "Создать заказ" },
        { href: "/orders/new?type=return", label: "Создать возврат с полки" },
        { href: "/orders/new?type=return_by_order", label: "Возврат с полки по заказу" },
        { href: "/orders/new?type=exchange", label: "Создать обмен" }
      ]
    },
    {
      title: "УПРАВЛЕНИЕ ЗАКАЗАМИ",
      items: [
        { href: "/orders", label: "Заявки" },
        { href: "/orders/refusals", label: "Отказы" },
        { href: "/returns", label: "Список возвратов" }
      ]
    }
  ]
};

/** Накладные — alohida modul (rasmdagi panel kabi) */
export const dashboardInvoicesNav: {
  sectionTitle: string;
  items: NavItem[];
} = {
  sectionTitle: "Накладные",
  items: [
    { href: "/invoices/assembly", label: "Сборочные накладные" },
    { href: "/invoices/shipment", label: "Отгрузочные накладные" },
    { href: "/invoices/returns", label: "Возвратные накладные" }
  ]
};

export function dashboardOrdersNavFlatItems(): NavItem[] {
  return dashboardOrdersNav.groups.flatMap((g) => g.items);
}

/**
 * Касса — rasm (Lalaku): guruhlar + ichki havolalar.
 * `disabled: true` — sahifa keyinroq qo‘shiladi (`href` hozircha `#`).
 */
export const dashboardKassaNav: {
  sectionTitle: string;
  groups: { title: string; items: NavItem[] }[];
} = {
  sectionTitle: "Касса",
  groups: [
    {
      title: "РАСЧЕТЫ С КЛИЕНТАМИ",
      items: [
        { href: "/payments", label: "Оплаты клиентов" },
        { href: "/client-expenses", label: "Расходы клиента" },
        { href: "/initial-client-balances", label: "Начальные балансы клиентов" },
        { href: "/client-balances", label: "Балансы клиентов (оплата и долги)" },
        { href: "/client-balances/consignment", label: "Балансы клиентов по консигнации" }
      ]
    },
    {
      title: "ОТЧЁТЫ",
      items: [
        { href: "/reports", label: "Отчёт по приходам" },
        { href: "/reports/cash-flow", label: "Движение денежных средств" },
        { href: "/reports/client-reconciliation", label: "Акт сверки" },
        { href: "/reports/order-debts", label: "Долги по заказам" }
      ]
    },
    {
      title: "ПРОЧИЕ",
      items: [
        { href: "/settings/cash-desks", label: "Касса" },
        { href: "/currency-rates", label: "Курс валют" },
        { href: "#", label: "Приходы", disabled: true },
        { href: "/expenses", label: "Расходы" },
        { href: "/expeditor-payment-requests", label: "Заявки на оплату" },
        { href: "#", label: "Долги экспедитора", disabled: true }
      ]
    }
  ]
};

export function dashboardKassaNavFlatItems(): NavItem[] {
  return dashboardKassaNav.groups.flatMap((g) => g.items).filter((i) => !i.disabled && i.href !== "#");
}

/**
 * Пользователи — referens UI: КОМАНДА + ПРОЧИЕ.
 * `disabled` / `href: "#"` — sahifa keyinroq qo‘shiladi.
 */
export const dashboardUsersNav: {
  sectionTitle: string;
  groups: { title: string; items: NavItem[] }[];
} = {
  sectionTitle: "Пользователи",
  groups: [
    {
      title: "КОМАНДА",
      items: [
        { href: "/settings/spravochnik/agents", label: "Агент" },
        {
          href: "/work-slots",
          label: "Рабочее место",
          roles: ["admin", "operator", "supervisor", "director", "sales_director", "regional_manager", "accountant"]
        },
        { href: "/settings/spravochnik/expeditors", label: "Экспедиторы" },
        { href: "/settings/spravochnik/supervisors", label: "Супервайзер" },
        { href: "/settings/spravochnik/skladchik", label: "Складчик" },
        { href: "/settings/spravochnik/collectors", label: "Инкассатор" },
        { href: "/settings/spravochnik/auditors", label: "Аудиторы" }
      ]
    },
    {
      title: "ПРОЧИЕ",
      items: [
        { href: "/settings/spravochnik/operators", label: "Сотрудники", roles: ["admin"] },
        { href: "#", label: "Партнёры", disabled: true },
        { href: "/settings/spravochnik/consignment", label: "Консигнация" },
        { href: "/settings/reasons/task-types", label: "Задачи" },
        { href: "#", label: "Рабочие дни", disabled: true },
        { href: "/users/timesheet", label: "Табель" }
      ]
    }
  ]
};

export function dashboardUsersNavFlatItems(): NavItem[] {
  return dashboardUsersNav.groups.flatMap((g) => g.items).filter((i) => !i.disabled && i.href !== "#");
}

/** Клиенты — отдельный модуль в боковой панели */
export const dashboardClientsNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Клиенты",
  items: [
    { href: "/clients", label: "Список клиентов" },
    { href: "/clients/map", label: "Клиенты на карте" },
    { href: "/clients/qr", label: "QR коды клиентов" },
    { href: "/clients/merge", label: "Объединение клиентов" },
    { href: "/clients/equipment", label: "Оборудование" },
    { href: "/clients/retail-stock", label: "Остатки в торговых точках" },
    { href: "#", label: "Отчёт по таре", disabled: true }
  ]
};

/**
 * Поставщики — реестр + (позже) оплаты, балансы, акт сверки.
 */
export const dashboardSuppliersNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Поставщики",
  items: [
    { href: "/suppliers", label: "Поставщики" },
    { href: "/suppliers/payments", label: "Оплаты поставщикам" },
    { href: "/suppliers/balances", label: "Начальные балансы с поставщиком" },
    { href: "/suppliers/reconciliation", label: "Акт сверки с поставщиком" }
  ]
};

export function dashboardSuppliersNavFlatItems(): NavItem[] {
  return dashboardSuppliersNav.items.filter((i) => !i.disabled && i.href !== "#");
}

/** Отчёт — rasm bo‘yicha alohida modul (hozircha placeholder sahifalar). */
export const dashboardReportsNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Отчёт",
  items: [
    { href: "/reports/agent-orders", label: "Заказы по агентам" },
    { href: "/reports/gps", label: "Отчёт по GPS" },
    { href: "/reports/client-sales-2", label: "Продажи по клиентам 2" },
    { href: "/reports/client-sales-4", label: "Продажи по клиентам 4" },
    { href: "/reports/product-sales", label: "Продажи по товарам" },
    { href: "/reports/expeditor-returns", label: "Возврат экспедитора" },
    { href: "/reports/visits-2", label: "По визитам 2.0" },
    { href: "/reports/visit-totals", label: "Итоги визитов" },
    { href: "/reports/builder", label: "Конструктор отчетов" },
    { href: "/reports/settings", label: "Настройки отчетов" }
  ]
};

export function dashboardReportsNavFlatItems(): NavItem[] {
  return dashboardReportsNav.items.filter((i) => !i.disabled && i.href !== "#");
}

/** Chap panel tartibi — referens UI (yashil sidebar) */
export type SidebarLayoutEntry =
  | { kind: "link"; item: NavItem }
  | { kind: "dashboard" }
  | { kind: "clients" }
  | { kind: "orders" }
  | { kind: "invoices" }
  | { kind: "stock" }
  | { kind: "suppliers" }
  | { kind: "reports" }
  | { kind: "kassa" }
  | { kind: "users" };

export const dashboardSidebarLayout: SidebarLayoutEntry[] = [
  { kind: "dashboard" },
  { kind: "orders" },
  { kind: "invoices" },
  { kind: "clients" },
  { kind: "stock" },
  { kind: "suppliers" },
  { kind: "reports" },
  { kind: "kassa" },
  { kind: "users" },
  { kind: "link", item: { href: "/access", label: "Доступ", roles: ["admin"], showIfAnyPermission: ["access.manage"] } },
  { kind: "link", item: { href: "/settings", label: "Настройки" } }
];

/** Mobil menyu — barcha havolalar (ixtiyoriy tartibsiz) */
export function flattenMobileNavItems(): NavItem[] {
  const out: NavItem[] = [];
  for (const e of dashboardSidebarLayout) {
    if (e.kind === "dashboard") {
      out.push(...dashboardHomeNav.items);
    } else if (e.kind === "clients") {
      out.push(...dashboardClientsNav.items.filter((i) => !i.disabled && i.href !== "#"));
    } else if (e.kind === "link") {
      if (!e.item.disabled && e.item.href !== "#") {
        out.push(e.item);
      }
    } else if (e.kind === "orders") {
      out.push(...dashboardOrdersNavFlatItems());
    } else if (e.kind === "invoices") {
      out.push(...dashboardInvoicesNav.items.filter((i) => !i.disabled && i.href !== "#"));
    } else if (e.kind === "stock") {
      out.push(...dashboardStockNav.items.filter((i) => !i.disabled && i.href !== "#"));
    } else if (e.kind === "suppliers") {
      out.push(...dashboardSuppliersNavFlatItems());
    } else if (e.kind === "reports") {
      out.push(...dashboardReportsNavFlatItems());
    } else if (e.kind === "kassa") {
      out.push(...dashboardKassaNavFlatItems());
    } else if (e.kind === "users") {
      out.push(...dashboardUsersNavFlatItems());
    }
  }
  return out;
}

/** Orqalik: bo‘sh guruh (eski importlar buzilmasin) */
export const dashboardNavGroups: NavGroup[] = [
  {
    title: "Меню",
    items: [
      { href: "/dashboard", label: "Дашборд" },
      { href: "/clients", label: "Клиенты" },
      { href: "/settings", label: "Настройки" }
    ]
  }
];

export function flattenNavItems(groups: NavGroup[]): NavItem[] {
  return groups.flatMap((g) => g.items);
}
