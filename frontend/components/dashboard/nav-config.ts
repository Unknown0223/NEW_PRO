import { NAV_PERM } from "@/components/dashboard/nav-permission-keys";

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
    {
      href: "/dashboard",
      label: "Супервайзер",
      showIfAnyPermission: ["dashboard.supervayzer.view", "dashboard.supervayzer"]
    },
    {
      href: "/dashboard/expeditors",
      label: "Доставщики",
      showIfAnyPermission: ["dashboard.supervayzer.view", "dashboard.supervayzer"]
    },
    {
      href: "/dashboard/finance",
      label: "Финансы",
      showIfAnyPermission: ["dashboard.finansy.view", "dashboard.finansy"]
    },
    {
      href: "/dashboard/sales",
      label: "Дашборд продаж",
      showIfAnyPermission: ["dashboard.prodazhi.view", "dashboard.prodazhi"]
    },
    {
      href: "/dashboard/sales-monitoring",
      label: "Мониторинг продаж и планов",
      showIfAnyPermission: ["dashboard.plan_fakt.view", "dashboard.plan_fakt"]
    }
  ]
};

/** Rasm (Lalaku-style) bo‘yicha: ombor */
export const dashboardStockNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Склад",
  items: [
    { href: "/stock/warehouses", label: "Склад", showIfAnyPermission: [...NAV_PERM.stockWarehouses] },
    { href: "/stock/blocks", label: "Блок склада", showIfAnyPermission: [...NAV_PERM.stockBlocks] },
    { href: "/stock/balances", label: "Остатки товаров", showIfAnyPermission: [...NAV_PERM.stockBalances] },
    {
      href: "/stock/recommended",
      label: "Остатки товара на складе (рекомендованный запас)",
      showIfAnyPermission: [...NAV_PERM.stockRecommended]
    },
    { href: "/stock/by-date", label: "Остатки на определенную дату", showIfAnyPermission: [...NAV_PERM.stockByDate] },
    { href: "/stock/receipts", label: "Поступление", showIfAnyPermission: [...NAV_PERM.stockReceipts] },
    { href: "/stock/receipts-report", label: "Отчёт по приходам", showIfAnyPermission: [...NAV_PERM.stockReceipts] },
    { href: "/stock/transfers", label: "Перемещение товара", showIfAnyPermission: [...NAV_PERM.stockTransfers] },
    {
      href: "/stock/correction",
      label: "Корректировка склада",
      roles: ["admin"],
      showIfAnyPermission: [...NAV_PERM.stockCorrection]
    },
    { href: "/stock/material-report", label: "Материальный отчёт", showIfAnyPermission: [...NAV_PERM.stockMaterial] },
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
        { href: "/orders/new?type=order", label: "Создать заказ", showIfAnyPermission: [...NAV_PERM.ordersCreate] },
        {
          href: "/orders/new?type=return",
          label: "Создать возврат с полки",
          showIfAnyPermission: [...NAV_PERM.returnsCreate]
        },
        {
          href: "/orders/new?type=return_by_order",
          label: "Создать возврат с полки по заказу",
          showIfAnyPermission: [...NAV_PERM.returnsCreate]
        },
        {
          href: "/orders/new?type=exchange",
          label: "Создать обмен",
          showIfAnyPermission: [...NAV_PERM.exchangeCreate]
        }
      ]
    },
    {
      title: "УПРАВЛЕНИЕ ЗАКАЗАМИ",
      items: [
        { href: "/orders", label: "Заявки", showIfAnyPermission: [...NAV_PERM.ordersView] },
        { href: "/orders/refusals", label: "Отказы", showIfAnyPermission: [...NAV_PERM.exchangeView] },
        { href: "/orders/automation", label: "Автоматизация заявок", showIfAnyPermission: [...NAV_PERM.automation] }
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
    {
      href: "/invoices/assembly",
      label: "Сборочные накладные",
      showIfAnyPermission: [...NAV_PERM.invoicesAssembly]
    },
    {
      href: "/invoices/shipment",
      label: "Отгрузочные накладные",
      showIfAnyPermission: [...NAV_PERM.invoicesShipment]
    },
    {
      href: "/invoices/returns",
      label: "Возвратные накладные",
      showIfAnyPermission: [...NAV_PERM.invoicesReturns]
    },
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
        { href: "/payments", label: "Оплаты клиентов", showIfAnyPermission: [...NAV_PERM.cashPayments] },
        {
          href: "/client-expenses",
          label: "Расходы клиента",
          showIfAnyPermission: [...NAV_PERM.cashClientExpenses]
        },
        {
          href: "/initial-client-balances",
          label: "Начальные балансы клиентов",
          showIfAnyPermission: [...NAV_PERM.cashOpeningBalances]
        },
        {
          href: "/client-balances",
          label: "Балансы клиентов (оплата и долги)",
          showIfAnyPermission: [...NAV_PERM.cashClientBalances]
        }
      ]
    },
    {
      title: "ОТЧЁТЫ",
      items: [
        { href: "/reports", label: "Отчёт по приходам", showIfAnyPermission: [...NAV_PERM.cashReports] },
        {
          href: "/reports/cash-flow",
          label: "Движение денежных средств",
          showIfAnyPermission: [...NAV_PERM.cashReports]
        },
        {
          href: "/reports/client-reconciliation",
          label: "Акт сверки",
          showIfAnyPermission: [...NAV_PERM.cashReports]
        },
        {
          href: "/reports/order-debts",
          label: "Долги по заказам",
          showIfAnyPermission: [...NAV_PERM.cashReports]
        }
      ]
    },
    {
      title: "ПРОЧИЕ",
      items: [
        { href: "/settings/cash-desks", label: "Касса", showIfAnyPermission: [...NAV_PERM.cashDesks] },
        { href: "/currency-rates", label: "Курс валют", showIfAnyPermission: [...NAV_PERM.cashCurrency] },
        { href: "#", label: "Приходы", placeholder: true },
        { href: "/expenses", label: "Расходы", showIfAnyPermission: [...NAV_PERM.cashExpenses] },
        {
          href: "/expeditor-payment-requests",
          label: "Заявки на оплату",
          showIfAnyPermission: [...NAV_PERM.cashPaymentRequests]
        },
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
        {
          href: "/settings/spravochnik/agents",
          label: "Агент",
          showIfAnyPermission: [...NAV_PERM.staffAgent]
        },
        {
          href: "/work-slots",
          label: "Рабочее место",
          showIfAnyPermission: [...NAV_PERM.workSlots]
        },
        {
          href: "/settings/spravochnik/expeditors",
          label: "Экспедиторы",
          showIfAnyPermission: [...NAV_PERM.staffExpeditor]
        },
        {
          href: "/settings/spravochnik/supervisors",
          label: "Супервайзер",
          showIfAnyPermission: [...NAV_PERM.staffSupervisor]
        },
        {
          href: "/settings/spravochnik/skladchik",
          label: "Складчик",
          showIfAnyPermission: [...NAV_PERM.staffSkladchik]
        },
        {
          href: "/settings/spravochnik/collectors",
          label: "Инкассатор",
          showIfAnyPermission: [...NAV_PERM.staffCollector]
        },
        {
          href: "/settings/spravochnik/auditors",
          label: "Аудиторы",
          showIfAnyPermission: [...NAV_PERM.staffAuditor]
        }
      ]
    },
    {
      title: "ПРОЧИЕ",
      items: [
        {
          href: "/settings/spravochnik/operators",
          label: "Сотрудники",
          roles: ["admin"],
          showIfAnyPermission: [...NAV_PERM.staffEmployees]
        },
        { href: "#", label: "Партнёры", placeholder: true },
        {
          href: "/settings/spravochnik/consignment",
          label: "Консигнация",
          showIfAnyPermission: [...NAV_PERM.staffConsignment]
        },
        { href: "#", label: "Настройки бонусов и зарплат", placeholder: true },
        { href: "/settings/payroll", label: "Зарплата", showIfAnyPermission: [...NAV_PERM.staffPayroll] },
        { href: "/users/workdays", label: "Рабочие дни", showIfAnyPermission: [...NAV_PERM.staffWorkdays] },
        { href: "/users/timesheet", label: "Табель", showIfAnyPermission: [...NAV_PERM.staffTimesheet] },
        {
          href: "/settings/reasons/task-types",
          label: "Задачи",
          showIfAnyPermission: [...NAV_PERM.staffTasks]
        }
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
    { href: "/clients", label: "Клиенты", showIfAnyPermission: [...NAV_PERM.clients] },
    { href: "/clients/map", label: "Клиенты на карте", showIfAnyPermission: [...NAV_PERM.clientsMap] },
    {
      href: "/clients/visit-planner",
      label: "Назначение визитов на карте",
      showIfAnyPermission: [...NAV_PERM.visitPlanner]
    },
    { href: "/clients/merge", label: "Объединение клиентов", showIfAnyPermission: [...NAV_PERM.clientsMerge] },
    { href: "/clients/equipment", label: "Оборудования", showIfAnyPermission: [...NAV_PERM.clientsEquipment] },
    {
      href: "/clients/retail-stock",
      label: "Остатки в торговых точках",
      showIfAnyPermission: [...NAV_PERM.clientsRetailStock]
    },
    { href: "#", label: "Отчёт по таре", placeholder: true }
  ]
};

/**
 * Поставщики — реестр + (позже) оплаты, балансы, акт сверки.
 */
export const dashboardSuppliersNav: { sectionTitle: string; items: NavItem[] } = {
  sectionTitle: "Поставщики",
  items: [
    { href: "/suppliers", label: "Поставщики", showIfAnyPermission: [...NAV_PERM.suppliers] },
    {
      href: "/suppliers/payments",
      label: "Оплаты поставщикам",
      showIfAnyPermission: [...NAV_PERM.suppliersPayments]
    },
    {
      href: "/suppliers/balances",
      label: "Начальные балансы с поставщиком",
      showIfAnyPermission: [...NAV_PERM.suppliersBalances]
    },
    {
      href: "/suppliers/reconciliation",
      label: "Акт сверки с поставщиком",
      showIfAnyPermission: [...NAV_PERM.suppliersReconciliation]
    },
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
    { href: "/reports/agent-orders", label: "Заказы по агентам", showIfAnyPermission: [...NAV_PERM.reports] },
    {
      href: "/reports/gps",
      label: "Отчёт по GPS",
      showIfAnyPermission: [...NAV_PERM.reports, "gps.gps.view"]
    },
    {
      href: "/reports/client-sales-2",
      label: "Продажи по клиентам 2",
      showIfAnyPermission: [...NAV_PERM.reports]
    },
    {
      href: "/reports/client-sales-4",
      label: "Продажи по клиентам 4",
      showIfAnyPermission: [...NAV_PERM.reports]
    },
    { href: "/reports/product-sales", label: "Продажи по товарам", showIfAnyPermission: [...NAV_PERM.reports] },
    {
      href: "/reports/expeditor-returns",
      label: "Возврат экспедитора",
      showIfAnyPermission: [...NAV_PERM.reports]
    },
    { href: "/reports/visits-2", label: "По визитам 2.0", showIfAnyPermission: [...NAV_PERM.reports] },
    { href: "/reports/visit-totals", label: "Итоги визитов", showIfAnyPermission: [...NAV_PERM.reports] },
    {
      href: "/reports/builder",
      label: pivotEngineNavEnabled
        ? "Конструктор сводной таблицы"
        : "Конструктор отчетов (WebDataRocks)",
      showIfAnyPermission: [...NAV_PERM.reportBuilder]
    },
    ...(pivotEngineNavEnabled
      ? []
      : []),
    { href: "/reports/settings", label: "Настройки отчетов", showIfAnyPermission: [...NAV_PERM.reports] }
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
      href: "/plans/daily",
      label: "Дневные KPI планы",
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
 * Планы → Отчёт → Пользователи → Аудит → Доступ → Настройки.
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
  { kind: "users" },
  {
    kind: "link",
    item: {
      href: "/audit",
      label: "Аудит",
      showIfAnyPermission: [...NAV_PERM.audit]
    }
  },
  { kind: "link", item: { href: "/activity", label: "Активность и история", roles: ["admin"] } },
  {
    kind: "link",
    item: {
      href: "/diagnostics/errors",
      label: "Журнал ошибок",
      roles: ["admin"],
      showIfAnyPermission: ["diagnostics.error_logs.view"]
    }
  },
  {
    kind: "link",
    item: {
      href: "/access",
      label: "Доступ",
      roles: ["admin"],
      showIfAnyPermission: ["access.upravlenie.view"]
    }
  },
  {
    kind: "link",
    item: { href: "/settings", label: "Настройки", showIfAnyPermission: [...NAV_PERM.settings] }
  }
];

/** Mobil menyu — barcha havolalar (ixtiyoriy tartibsiz) */
export function flattenMobileNavItems(): NavItem[] {
  const out: NavItem[] = [];
  const seen = new Set<string>();
  const pushUnique = (item: NavItem) => {
    if (item.disabled || item.href === "#") return;
    const path = item.href.split("?")[0] ?? item.href;
    if (seen.has(path)) return;
    seen.add(path);
    out.push(item);
  };
  for (const e of dashboardSidebarLayout) {
    if (e.kind === "dashboard") {
      for (const item of dashboardHomeNav.items) pushUnique(item);
    } else if (e.kind === "clients") {
      for (const item of dashboardClientsNav.items.filter((i) => !i.disabled && i.href !== "#")) pushUnique(item);
    } else if (e.kind === "link") {
      pushUnique(e.item);
    } else if (e.kind === "orders") {
      for (const item of dashboardOrdersNavFlatItems()) pushUnique(item);
    } else if (e.kind === "invoices") {
      for (const item of dashboardInvoicesNav.items.filter((i) => !i.disabled && i.href !== "#")) pushUnique(item);
    } else if (e.kind === "stock") {
      for (const item of dashboardStockNav.items.filter((i) => !i.disabled && i.href !== "#")) pushUnique(item);
    } else if (e.kind === "suppliers") {
      for (const item of dashboardSuppliersNavFlatItems()) pushUnique(item);
    } else if (e.kind === "reports") {
      for (const item of dashboardReportsNavFlatItems()) pushUnique(item);
    } else if (e.kind === "plans") {
      for (const item of dashboardPlansNavFlatItems()) pushUnique(item);
    } else if (e.kind === "kassa") {
      for (const item of dashboardKassaNavFlatItems()) pushUnique(item);
    } else if (e.kind === "users") {
      for (const item of dashboardUsersNavFlatItems()) pushUnique(item);
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
    { href: "/audit", label: "Аудит" },
    { href: "/activity", label: "Активность и история" },
    { href: "/diagnostics/errors", label: "Журнал ошибок" },
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
