export const AUTOMATION_VIEW_PERMISSION = "orders.avtomatizatsiya.view";
export const AUTOMATION_EXPORT_PERMISSION = "orders.avtomatizatsiya.export";
export const AUTOMATION_UPDATE_PERMISSION = "orders.avtomatizatsiya.update";
export const AUTOMATION_ACTIVATE_PERMISSION = "orders.avtomatizatsiya.activate";
export const AUTOMATION_DEACTIVATE_PERMISSION = "orders.avtomatizatsiya.deactivate";

/**
 * Faqat `is_active` yuborilgan PATCH — ro'yxatdagi «Активировать / Деактивировать».
 * Boshqa maydonlar bilan — «Редактировать» formasi (`update`).
 */
export function automationPatchPermission(body: unknown): string {
  if (body && typeof body === "object") {
    const keys = Object.keys(body);
    const active = (body as { is_active?: unknown }).is_active;
    if (keys.length === 1 && typeof active === "boolean") {
      return active ? AUTOMATION_ACTIVATE_PERMISSION : AUTOMATION_DEACTIVATE_PERMISSION;
    }
  }
  return AUTOMATION_UPDATE_PERMISSION;
}

/** Ro'yxat GET: `?export=csv` — Excel (CSV) yuklab olish alohida ruxsat. */
export function automationListPermission(query: unknown): string {
  return (query as { export?: unknown } | null)?.export === "csv" ? AUTOMATION_EXPORT_PERMISSION : AUTOMATION_VIEW_PERMISSION;
}
