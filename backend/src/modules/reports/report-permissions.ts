/**
 * «Отчёт» — har bir hisobot sahifasi alohida ruxsat (ko'rish / Excel).
 * Route darajasidagi preHandler — umumiy (kamida bittasi); aniq sahifa global guardda.
 */
export const REPORT_PAGE_PERMISSIONS: ReadonlyArray<{ path: string; section: string; export: boolean }> = [
  { path: "agent-orders", section: "reports.zakazy_agentov", export: false },
  { path: "gps-delivery-routes", section: "reports.gps", export: true },
  { path: "client-sales-2", section: "reports.prodazhi_klientov_2", export: true },
  { path: "client-sales-4", section: "reports.prodazhi_klientov_4", export: true },
  { path: "product-sales", section: "reports.prodazhi_tovarov", export: true },
  { path: "expeditor-returns", section: "reports.vozvrat_ekspeditora", export: true },
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
