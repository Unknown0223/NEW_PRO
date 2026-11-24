import type { PermissionAction, PermissionSectionDef } from "./permission-model";

const VIEW_ONLY: PermissionAction[] = ["view"];
const VIEW_EXPORT: PermissionAction[] = ["view", "export"];

/**
 * «Отчёт» — `REPORT_PAGE_PERMISSIONS` + konstruktor/KPI bilan sync.
 * Yangi hisobot sahifasi: shu yerga + report-permissions.ts + op-labels.
 */
export const REPORT_PERMISSION_SECTIONS: PermissionSectionDef[] = [
  { module: "reports", section: "zakazy_agentov", labelRu: "Заказы по агентам", actions: VIEW_ONLY },
  { module: "reports", section: "gps", labelRu: "Отчёт по GPS (маршруты доставки)", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_klientov_2", labelRu: "Продажи по клиентам 2", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_klientov_3", labelRu: "Продажи по клиентам 3", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_klientov_4", labelRu: "Продажи по клиентам 4", actions: VIEW_EXPORT },
  { module: "reports", section: "prodazhi_tovarov", labelRu: "Продажи по товарам", actions: VIEW_EXPORT },
  { module: "reports", section: "sravnitelnyy_analiz", labelRu: "Сравнительный анализ продаж", actions: VIEW_EXPORT },
  { module: "reports", section: "p1", labelRu: "P1 отчёт", actions: VIEW_EXPORT },
  { module: "reports", section: "vozvrat_ekspeditora", labelRu: "Возврат экспедитора", actions: VIEW_EXPORT },
  {
    module: "reports",
    section: "vozvrat_s_polki",
    labelRu: "Отчет по возвратам (возврат с полки)",
    actions: VIEW_EXPORT
  },
  { module: "reports", section: "kolichestvo_zakazov", labelRu: "Отчет по количеству заказов", actions: VIEW_EXPORT },
  { module: "reports", section: "po_sku_3", labelRu: "По Sku 3.0", actions: VIEW_EXPORT },
  { module: "reports", section: "otgruzki_ekspeditorov", labelRu: "Отгрузки по экспедиторам", actions: VIEW_EXPORT },
  { module: "reports", section: "excel_eksport", labelRu: "Excel экспорт", actions: VIEW_EXPORT },
  { module: "reports", section: "po_inventaryu", labelRu: "По инвентарю", actions: VIEW_EXPORT },
  { module: "reports", section: "fotootchyoty", labelRu: "Фотоотчёты", actions: VIEW_EXPORT },
  { module: "reports", section: "otchet_po_zadacham", labelRu: "Отчёт по задачам", actions: VIEW_EXPORT },
  { module: "reports", section: "po_bonusam", labelRu: "По бонусам", actions: VIEW_EXPORT },
  { module: "reports", section: "nakopitelnyy_bonus", labelRu: "Накопительный бонус", actions: VIEW_EXPORT },
  { module: "reports", section: "po_vizitam", labelRu: "По визитам", actions: VIEW_EXPORT },
  { module: "reports", section: "po_dnevnomu_poseshcheniyu", labelRu: "По дневному посещению", actions: VIEW_EXPORT },
  { module: "reports", section: "po_cenam", labelRu: "По ценам", actions: VIEW_EXPORT },
  { module: "reports", section: "klassifikatsiya_tt", labelRu: "Классификация торговых точек", actions: VIEW_EXPORT },
  { module: "reports", section: "vizity_ekspedirov", labelRu: "Визиты экспедиторов", actions: VIEW_EXPORT },
  { module: "reports", section: "doli_ekspedirov", labelRu: "Доли по экспедиторам", actions: VIEW_EXPORT },
  { module: "reports", section: "rfm", labelRu: "RFM", actions: VIEW_EXPORT },
  { module: "reports", section: "kontrol_balansov", labelRu: "Контроль балансов", actions: VIEW_EXPORT },
  { module: "reports", section: "universalnyy_vozvrat", labelRu: "Универсальный отчет по возвратам", actions: VIEW_EXPORT },
  { module: "reports", section: "universalnyy_bonus", labelRu: "Универсальный отчет по бонусам", actions: VIEW_EXPORT },
  { module: "reports", section: "universalnyy_vizity", labelRu: "Универсальный отчет по посещениям", actions: VIEW_EXPORT },
  { module: "reports", section: "universalnyy_prodazhi", labelRu: "Универсальный отчёт по продажам", actions: VIEW_EXPORT },
  { module: "reports", section: "universalnyy_skidki", labelRu: "Универсальный отчет по скидкам", actions: VIEW_EXPORT },
  { module: "reports", section: "detalnyy_skidki", labelRu: "Детальный отчет по скидкам", actions: VIEW_EXPORT },
  { module: "reports", section: "vizity", labelRu: "По визитам 2.0", actions: VIEW_EXPORT },
  { module: "reports", section: "itogi_vizitov", labelRu: "Итоги визитов", actions: VIEW_EXPORT },
  { module: "reports", section: "dnevnye_kpi_plany", labelRu: "Дневные KPI планы", actions: VIEW_EXPORT },
  {
    module: "reports",
    section: "konstruktor",
    labelRu: "Конструктор сводной таблицы",
    actions: ["view", "create", "update", "delete", "export", "transfer"]
  }
];
