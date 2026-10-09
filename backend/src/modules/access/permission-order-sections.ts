import type { PermissionSectionDef } from "./permission-model";

const ORDER_ZAKAZ_TREE_RU = "Заявки";
const ORDER_STATUS_TREE_RU = "Статус";
const ORDER_STATUS_SECTIONS: [section: string, labelRu: string][] = [
  ["status_confirmed", "Подтверждён"], ["status_picking", "Комплектация"], ["status_delivering", "Отгружен"],
  ["status_delivered", "Доставлен"], ["status_returned", "Возврат"], ["status_cancelled", "Отменён"],
  ["status_revert", "Шаг назад"], ["status_reopen", "Восстановление отменённого"]
];

/**
 * «Заявки» bo'limlari. Yaratish, qaytarish va obmen — alohida kalitlar, lekin daraxtda «Заявки» ichida.
 * Yaratish turi (`order_type`) va qaytarish turi serverda: `orders/order-create-permissions.ts`.
 * Har bir status o'tishi — alohida operatsiya (`orders/order-status-permissions.ts`).
 */
export const ORDER_PERMISSION_SECTIONS: PermissionSectionDef[] = [
  { module: "orders", section: "zakaz", labelRu: "Заявки", actions: ["view", "update", "copy", "export", "assign", "history"] },
  { module: "orders", section: "sozdanie", labelRu: "Создать заказ", actions: ["create"], treeSectionRu: ORDER_ZAKAZ_TREE_RU },
  { module: "orders", section: "vozvrat_polki", labelRu: "Создать возврат с полки", actions: ["create"], treeSectionRu: ORDER_ZAKAZ_TREE_RU },
  {
    module: "orders",
    section: "vozvrat_po_zakazu",
    labelRu: "Создать возврат с полки по заказу",
    actions: ["create"],
    treeSectionRu: ORDER_ZAKAZ_TREE_RU
  },
  { module: "orders", section: "obmen", labelRu: "Создать обмен", actions: ["create"], treeSectionRu: ORDER_ZAKAZ_TREE_RU },
  { module: "orders", section: "otkazy", labelRu: "Отказы", actions: ["view", "create", "export"] },
  {
    module: "orders",
    section: "avtomatizatsiya",
    labelRu: "Автоматизация заявок",
    actions: ["view", "create", "update", "delete", "restore", "export", "activate", "deactivate"]
  },
  ...ORDER_STATUS_SECTIONS.map(
    ([section, labelRu]): PermissionSectionDef => ({ module: "orders", section, labelRu, actions: ["status"], treeSectionRu: ORDER_STATUS_TREE_RU })
  ),
  { module: "orders", section: "status_date", labelRu: "Дата статуса", actions: ["update"], treeSectionRu: ORDER_STATUS_TREE_RU },
  { module: "orders", section: "drugie_operacii", labelRu: "Другие операции", actions: ["update"] }
];
