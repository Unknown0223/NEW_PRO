/** Client merge cannot safely reverse balance consolidation / FK reassignment. */
export const CLIENT_MERGE_IRREVERSIBLE = true as const;

export const CLIENT_MERGE_CONSEQUENCES: readonly string[] = [
  "Заказы, платежи, возвраты, визиты, фотоотчёты и оборудование переносятся на мастер-клиента",
  "Балансы объединяются; отдельные балансы исходных клиентов удаляются",
  "Исходные клиенты деактивируются и помечаются как объединённые",
  "Назначения агентов с занятыми слотами отбрасываются",
  "Операцию нельзя отменить (undo недоступен)"
];
