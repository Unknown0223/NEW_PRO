/**
 * Skladchik «Конфигурации» — kalitlar backend `SKLADCHIK_ENTITLEMENT_KEYS` bilan mos bo‘lishi kerak.
 */
export type SkladchikEntitlementGroup = {
  title: string;
  items: { key: string; label: string }[];
};

export const SKLADCHIK_ENTITLEMENT_GROUPS: SkladchikEntitlementGroup[] = [
  {
    title: "Склад реализации",
    items: [{ key: "sales_warehouse_list", label: "Список склад реализации" }]
  },
  {
    title: "Склад для возврата",
    items: [{ key: "return_warehouse_list", label: "Список склад для возврата" }]
  },
  {
    title: "Поступление",
    items: [
      { key: "receipt_list", label: "Список поступлений" },
      { key: "receipt_add", label: "Добавить поступление" },
      { key: "receipt_confirm", label: "Подтвердить поступление" },
      { key: "receipt_change", label: "Изменить поступление" }
    ]
  },
  {
    title: "Остатки товара на складе",
    items: [{ key: "stock_balance_list", label: "Список остатков" }]
  },
  {
    title: "Корректировка",
    items: [
      { key: "correction_list", label: "Список корректировок" },
      { key: "correction_add", label: "Добавить корректировку" }
    ]
  },
  {
    title: "Перемещение товара",
    items: [
      { key: "transfer_list", label: "Список перемещений" },
      { key: "transfer_add", label: "Добавить перемещение" }
    ]
  },
  {
    title: "Сборочные накладные",
    items: [
      { key: "assembly_list", label: "Список" },
      { key: "assembly_detail", label: "Детали" },
      { key: "assembly_create", label: "Создать" },
      { key: "assembly_collect", label: "Собрать" },
      { key: "assembly_verify", label: "Проверить" }
    ]
  },
  {
    title: "Отгрузочные накладные",
    items: [
      { key: "shipping_list", label: "Список" },
      { key: "shipping_detail", label: "Детали" },
      { key: "shipping_confirm", label: "Подтвердить" },
      { key: "shipping_excel", label: "Скачать Excel" },
      { key: "shipping_create", label: "Создать" }
    ]
  },
  {
    title: "Возвратные накладные",
    items: [
      { key: "return_invoice_list", label: "Список" },
      { key: "return_invoice_detail", label: "Детали" },
      { key: "return_invoice_confirm", label: "Подтвердить" }
    ]
  },
  {
    title: "Блок склада",
    items: [
      { key: "warehouse_block_list", label: "Список блоков" },
      { key: "warehouse_block_confirm_empty", label: "Подтвердить пустой блок" }
    ]
  }
];

export function flattenEntitlementKeys(): string[] {
  return SKLADCHIK_ENTITLEMENT_GROUPS.flatMap((g) => g.items.map((i) => i.key));
}
