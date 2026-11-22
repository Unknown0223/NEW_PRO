/**
 * «Отчёт» — har bir hisobot sahifasi alohida ruxsat (ko'rish / Excel).
 * Route darajasidagi preHandler — umumiy (kamida bittasi); aniq sahifa global guardda.
 */
export const REPORT_PAGE_PERMISSIONS: ReadonlyArray<{ path: string; section: string; export: boolean }> = [
  { path: "agent-orders", section: "reports.zakazy_agentov", export: false },
  { path: "gps-delivery-routes", section: "reports.gps", export: true },
  { path: "client-sales-2", section: "reports.prodazhi_klientov_2", export: true },
  { path: "client-sales-3", section: "reports.prodazhi_klientov_3", export: true },
  { path: "client-sales-4", section: "reports.prodazhi_klientov_4", export: true },
  { path: "product-sales", section: "reports.prodazhi_tovarov", export: true },
  { path: "sales-compare", section: "reports.sravnitelnyy_analiz", export: true },
  { path: "p1", section: "reports.p1", export: true },
  { path: "expeditor-returns", section: "reports.vozvrat_ekspeditora", export: true },
  { path: "shelf-returns", section: "reports.vozvrat_s_polki", export: true },
  { path: "order-qty", section: "reports.kolichestvo_zakazov", export: true },
  { path: "sku-3", section: "reports.po_sku_3", export: true },
  { path: "expeditor-shipments", section: "reports.otgruzki_ekspeditorov", export: true },
  { path: "excel-export", section: "reports.excel_eksport", export: true },
  { path: "inventory", section: "reports.po_inventaryu", export: true },
  { path: "photo", section: "reports.fotootchyoty", export: true },
  { path: "tasks", section: "reports.otchet_po_zadacham", export: true },
  { path: "bonuses", section: "reports.po_bonusam", export: true },
  { path: "cumulative-bonus", section: "reports.nakopitelnyy_bonus", export: true },
  { path: "visits", section: "reports.po_vizitam", export: true },
  { path: "daily-visits", section: "reports.po_dnevnomu_poseshcheniyu", export: true },
  { path: "prices", section: "reports.po_cenam", export: true },
  { path: "outlet-class", section: "reports.klassifikatsiya_tt", export: true },
  { path: "expeditor-visits", section: "reports.vizity_ekspedirov", export: true },
  { path: "expeditor-share", section: "reports.doli_ekspedirov", export: true },
  { path: "rfm", section: "reports.rfm", export: true },
  { path: "balance-control", section: "reports.kontrol_balansov", export: true },
  { path: "universal-returns", section: "reports.universalnyy_vozvrat", export: true },
  { path: "universal-bonuses", section: "reports.universalnyy_bonus", export: true },
  { path: "universal-visits", section: "reports.universalnyy_vizity", export: true },
  { path: "universal-sales", section: "reports.universalnyy_prodazhi", export: true },
  { path: "universal-discounts", section: "reports.universalnyy_skidki", export: true },
  { path: "discount-detail", section: "reports.detalnyy_skidki", export: true },
  { path: "visits-2", section: "reports.vizity", export: true },
  { path: "visit-totals", section: "reports.itogi_vizitov", export: true }
];

export const REPORT_GROUP_VIEW_PERMISSIONS = [
  ...REPORT_PAGE_PERMISSIONS.map((p) => `${p.section}.view`),
  "reports.konstruktor.view"
];

export const REPORT_GROUP_EXPORT_PERMISSIONS = [
  ...REPORT_PAGE_PERMISSIONS.filter((p) => p.export).map((p) => `${p.section}.export`),
  "reports.konstruktor.export"
];

export const REPORT_VIEW_ANY_PERMISSIONS = ["reports.view", ...REPORT_GROUP_VIEW_PERMISSIONS, "cash.otchety.view"];

export const REPORT_EXPORT_ANY_PERMISSIONS = ["reports.export", ...REPORT_GROUP_EXPORT_PERMISSIONS, "cash.otchety.export"];
