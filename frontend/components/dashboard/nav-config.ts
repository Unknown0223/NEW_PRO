export type NavItem = {
  href: string;
  label: string;
  roles?: string[];
  /** Agar berilsa: ushbu permissionlardan kamida bittasi bo‘lsa ham ko‘rinadi (`roles` bilan OR). */
  showIfAnyPermission?: string[];
  disabled?: boolean;
  /**
   * Loyihada hali mavjud bo‘lmagan bo‘lim — sariq, bosib bo‘lmaydigan label.
   * Keyinchalik qo‘shish uchun tayyorlab qo‘yilgan «placeholder».
   */
  placeholder?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

/** Dashboard ichki bo'limlari (chap paneldagi ichki menyu) */
export const dashboardHomeNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Дашборды",
  items: [
    { href: "/dashboard", label: "Супервайзер" },
    { href: "/dashboard/expeditors", label: "Доставщики" },
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
    { href: "#", label: "Списание", placeholder: true }
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
        { href: "/orders/new?type=return_by_order", label: "Создать возврат с полки по заказу" },
        { href: "/orders/new?type=exchange", label: "Создать обмен" }
      ]
    },
    {
      title: "УПРАВЛЕНИЕ ЗАКАЗАМИ",
      items: [
        { href: "/orders", label: "Заявки" },
        { href: "/orders/refusals", label: "Отказы" },
        { href: "/orders/automation", label: "Автоматизация заявок" }
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
    { href: "/invoices/returns", label: "Возвратные накладные" },
    { href: "#", label: "Списания накладные", placeholder: true }
  ]
};

export function dashboardOrdersNavFlatItems(): NavItem[] {
  return dashboardOrdersNav.groups.flatMap((g) => g.items).filter((i) => !i.disabled && !i.placeholder && i.href !== "#");
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
        { href: "#", label: "Приходы", placeholder: true },
        { href: "/expenses", label: "Расходы" },
        { href: "/expeditor-payment-requests", label: "Заявки на оплату" },
        { href: "#", label: "Долги экспедитора", placeholder: true }
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
        { href: "#", label: "Партнёры", placeholder: true },
        { href: "/settings/spravochnik/consignment", label: "Консигнация" },
        { href: "#", label: "Настройки бонусов и зарплат", placeholder: true },
        { href: "/settings/payroll", label: "Зарплата" },
        { href: "#", label: "Рабочие дни", placeholder: true },
        { href: "/users/timesheet", label: "Табель" },
        { href: "/settings/reasons/task-types", label: "Задачи" }
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
    { href: "/clients", label: "Клиенты" },
    { href: "/clients/map", label: "Клиенты на карте" },
    { href: "/clients/visit-planner", label: "Назначение визитов на карте" },
    { href: "/clients/merge", label: "Объединение клиентов" },
    { href: "/clients/equipment", label: "Оборудования" },
    { href: "/clients/retail-stock", label: "Остатки в торговых точках" },
    { href: "#", label: "Отчёт по таре", placeholder: true }
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
    { href: "/suppliers/reconciliation", label: "Акт сверки с поставщиком" },
    { href: "#", label: "План", placeholder: true },
    { href: "#", label: "Баланс за период", placeholder: true }
  ]
};

export function dashboardSuppliersNavFlatItems(): NavItem[] {
  return dashboardSuppliersNav.items.filter((i) => !i.disabled && i.href !== "#");
}

/** Отчёт — rasm bo‘yicha alohida modul (hozircha placeholder sahifalar). */
/** Virtual Pivot — default yoqilgan (Sprint 8 cutover). */
const pivotEngineNavEnabled = true;

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
    {
      href: "/reports/builder",
      label: pivotEngineNavEnabled
        ? "Конструктор отчётов"
        : "Конструктор отчетов (WebDataRocks)"
    },
    ...(pivotEngineNavEnabled
      ? [
          { href: "/reports/builder/pivot", label: "Virtual Pivot (основной)" } satisfies NavItem,
          { href: "/reports/builder/wdr", label: "WebDataRocks (rollback)" } satisfies NavItem
        ]
      : []),
    { href: "/reports/settings", label: "Настройки отчетов" }
  ]
};

export function dashboardReportsNavFlatItems(): NavItem[] {
  return dashboardReportsNav.items.filter((i) => !i.disabled && i.href !== "#");
}

/** Планы — alohida modul (Настройка утверждающих va keyingi reja sahifalari). */
export const dashboardPlansNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Планы",
  items: [
    {
      href: "/plans/setup",
      label: "Установка планов",
      showIfAnyPermission: ["plans.ustanovka_planov.view"]
    },
    {
      href: "/plans/approvers",
      label: "Настройка утверждающих",
      showIfAnyPermission: ["plans.nastroyka_utverzhdayushchih.view"]
    }
  ]
};

export function dashboardPlansNavFlatItems(): NavItem[] {
  return dashboardPlansNav.items.filter((i) => !i.disabled && i.href !== "#");
}

/** Chap panel tartibi — referens UI (yashil sidebar) */
export type PlaceholderIconKey = "plans" | "pivot" | "audit";

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
  | { kind: "users" }
  | { kind: "plans" }
  /** Loyihada hali yo‘q bo‘lim — sariq, bosib bo‘lmaydigan sarlavha (keyin qo‘shamiz). */
  | { kind: "placeholder"; label: string; icon: PlaceholderIconKey };

/**
 * Referens UI tartibi:
 * Дашборды → Заявки → Клиенты → Накладные → Касса → Склад → Поставщики →
 * Планы → Отчёт → Pivot отчёты → Пользователи → Аудит → Доступ → Настройки.
 * «placeholder» bo‘limlar loyihada hali yo‘q — sariq label sifatida ko‘rinadi.
 */
export const dashboardSidebarLayout: SidebarLayoutEntry[] = [
  { kind: "dashboard" },
  { kind: "orders" },
  { kind: "clients" },
  { kind: "invoices" },
  { kind: "kassa" },
  { kind: "stock" },
  { kind: "suppliers" },
  { kind: "plans" },
  { kind: "reports" },
  { kind: "placeholder", label: "Pivot отчёты", icon: "pivot" },
  { kind: "users" },
  { kind: "placeholder", label: "Аудит", icon: "audit" },
  { kind: "link", item: { href: "/activity", label: "Активность и история", roles: ["admin"] } },
  { kind: "link", item: { href: "/access", label: "Доступ", roles: ["admin"], showIfAnyPermission: ["access.upravlenie.view"] } },
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
    } else if (e.kind === "plans") {
      out.push(...dashboardPlansNavFlatItems());
    } else if (e.kind === "kassa") {
      out.push(...dashboardKassaNavFlatItems());
    } else if (e.kind === "users") {
      out.push(...dashboardUsersNavFlatItems());
    }
  }
  return out;
}

/** Tepa header uchun: joriy yo'lga mos «bo'lim → sahifa» nomi. */
export type PageBreadcrumb = { section: string | null; label: string };

const BREADCRUMB_ENTRIES: Array<{ path: string; section: string | null; label: string }> = (() => {
  const out: Array<{ path: string; section: string | null; label: string }> = [];
  const pathOf = (href: string) => href.split("?")[0] ?? href;
  const push = (section: string | null, items: NavItem[]) => {
    for (const it of items) {
      if (it.href === "#" || it.placeholder) continue;
      const path = pathOf(it.href);
      if (!path || path === "#") continue;
      out.push({ path, section, label: it.label });
    }
  };
  push(dashboardHomeNav.sectionTitle, dashboardHomeNav.items);
  push(dashboardOrdersNav.sectionTitle, dashboardOrdersNavFlatItems());
  push(dashboardClientsNav.sectionTitle, dashboardClientsNav.items);
  push(dashboardInvoicesNav.sectionTitle, dashboardInvoicesNav.items);
  push(dashboardKassaNav.sectionTitle, dashboardKassaNavFlatItems());
  push(dashboardStockNav.sectionTitle, dashboardStockNav.items);
  push(dashboardSuppliersNav.sectionTitle, dashboardSuppliersNav.items);
  push(dashboardReportsNav.sectionTitle, dashboardReportsNav.items);
  push(dashboardPlansNav.sectionTitle, dashboardPlansNav.items);
  push(dashboardUsersNav.sectionTitle, dashboardUsersNavFlatItems());
  push(null, [
    { href: "/access", label: "Доступ" },
    { href: "/settings", label: "Настройки" }
  ]);
  return out;
})();

/**
 * Joriy `pathname` uchun eng aniq (eng uzun prefiksli) menyu bandini topadi.
 * Topilmasa `null` — tepa header chap qismi bo'sh qoladi.
 */
export function resolvePageBreadcrumb(pathname: string): PageBreadcrumb | null {
  let best: { section: string | null; label: string; len: number } | null = null;
  for (const e of BREADCRUMB_ENTRIES) {
    if (pathname === e.path || pathname.startsWith(`${e.path}/`)) {
      if (!best || e.path.length > best.len) {
        best = { section: e.section, label: e.label, len: e.path.length };
      }
    }
  }
  return best ? { section: best.section, label: best.label } : null;
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
