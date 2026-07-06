/** Default RU labels / sections for common permission keys (tenant seed). Merged with `LEGACY_PERMISSION_METADATA` in `permission-catalog.service` (defaults win on key collision). */
export const DEFAULT_PERMISSION_METADATA: Record<string, { description: string; section?: string }> = {
  "dashboard.view": { description: "Дашборд: просмотр", section: "Дашборд" },
  "orders.view": { description: "Заказы: просмотр", section: "Заказы" },
  "orders.create": { description: "Заказы: создание", section: "Заказы" },
  "orders.update": { description: "Заказы: редактирование", section: "Заказы" },
  "orders.delete": { description: "Заказы: удаление", section: "Заказы" },
  "finance.view": { description: "Финансы: просмотр", section: "Финансы" },
  "finance.approve": { description: "Финансы: утверждение", section: "Финансы" },
  "warehouse.view": { description: "Склад: просмотр", section: "Склад" },
  "warehouse.transfer": { description: "Склад: перемещение", section: "Склад" },
  "reports.view": { description: "Отчёты: просмотр", section: "Отчёты" },
  "reports.export": { description: "Отчёты: экспорт", section: "Отчёты" },
  "cashbox.income_report.view": {
    description: "Касса: отчёт по приходам (просмотр)",
    section: "Касса"
  },
  "cashbox.income_report.export": {
    description: "Касса: отчёт по приходам (экспорт)",
    section: "Касса"
  },
  "cashbox.income_report.by_agent": {
    description: "Касса: отчёт по приходам (по агентам)",
    section: "Касса"
  },
  "cashbox.income_report.by_territory": {
    description: "Касса: отчёт по приходам (по территории)",
    section: "Касса"
  },
  "users.manage": { description: "Пользователи: управление", section: "Пользователи" },
  "access.manage": { description: "Доступ: управление", section: "Доступ" },
  "access.upravlenie.view": { description: "Доступ: просмотр раздела", section: "Доступ" },
  "access.upravlenie.update": { description: "Доступ: изменение прав", section: "Доступ" },
  "access.upravlenie.history": { description: "Доступ: история изменений", section: "Доступ" },
  "audit.view": { description: "Аудит: просмотр", section: "Аудит" },
  "audit.log.view": { description: "Журнал аудита: просмотр", section: "Аудит" },
  "audit.log.copy": { description: "Журнал аудита: выгрузка", section: "Аудит" }
};
