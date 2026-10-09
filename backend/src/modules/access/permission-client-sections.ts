import type { PermissionSectionDef } from "./permission-model";

const CLIENT_GROUP_TREE_RU = "Групповая обработка";
const CLIENT_GROUP_SECTIONS: [section: string, labelRu: string][] = [
  ["gr_komanda", "Агент, дни визита и экспедитор"], ["gr_territoriya", "Территория (зона, область, город, район)"],
  ["gr_kategoriya", "Категория клиента"], ["gr_tip_format", "Тип и формат клиента"], ["gr_kanal", "Канал продаж"],
  ["gr_sklad_kassa", "Склад и касса"], ["gr_dolg", "Заказ при наличии долга и консигнация"],
  ["gr_kategoriya_tovara", "Категория товара"], ["gr_kredit_limit", "Кредитный лимит"], ["gr_tip_tseny", "Тип цены"], ["gr_tegi", "Теги"]
];
const VISIT_PLANNER_TREE_RU = "Назначение визитов на карте";
const VISIT_PLANNER_SECTIONS: [section: string, labelRu: string][] = [
  ["vizity_agent", "Агент"], ["vizity_dni", "Дни визитов"], ["vizity_ekspeditor", "Экспедитор"],
  ["vizity_sklad", "Склад"], ["vizity_kassa", "Касса"]
];

/**
 * «Клиенты» bo'limlari. Mijoz o'chirilmaydi — faqat deaktivatsiya.
 * Ommaviy tahrir va xarita maydonlari: `clients/client-bulk-permissions.ts`.
 */
export const CLIENT_PERMISSION_SECTIONS: PermissionSectionDef[] = [
  { module: "clients", section: "klient", labelRu: "Клиенты", actions: ["view", "create", "update", "import", "copy", "activate", "deactivate", "history"] },
  ...CLIENT_GROUP_SECTIONS.map(
    ([section, labelRu]): PermissionSectionDef => ({ module: "clients", section, labelRu, actions: ["update"], treeSectionRu: CLIENT_GROUP_TREE_RU })
  ),
  { module: "clients", section: "karta", labelRu: "Клиенты на карте", actions: ["view"] },
  { module: "clients", section: "vizity", labelRu: VISIT_PLANNER_TREE_RU, actions: ["view"], treeSectionRu: VISIT_PLANNER_TREE_RU },
  ...VISIT_PLANNER_SECTIONS.map(
    ([section, labelRu]): PermissionSectionDef => ({ module: "clients", section, labelRu, actions: ["update"], treeSectionRu: VISIT_PLANNER_TREE_RU })
  ),
  { module: "clients", section: "obedinenie", labelRu: "Объединение клиентов", actions: ["view", "update", "create", "delete", "restore", "history"] },
  { module: "clients", section: "oborudovanie", labelRu: "Оборудование", actions: ["view", "create", "delete", "export"] },
  { module: "clients", section: "foto", labelRu: "Фотоотчёты", actions: ["view", "create", "void", "restore"] },
  { module: "clients", section: "ostatki_tt", labelRu: "Остатки в торговых точках", actions: ["view", "import", "copy"] }
];
