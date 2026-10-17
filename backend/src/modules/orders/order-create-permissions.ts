/** «Заявки» → yaratish sahifalari: har bir tur alohida ruxsat. */
export const ORDER_CREATE_PERMISSION = "orders.sozdanie.create";
export const ORDER_EXCHANGE_PERMISSION = "orders.obmen.create";
export const RETURN_SHELF_PERMISSION = "orders.vozvrat_polki.create";
export const RETURN_BY_ORDER_PERMISSION = "orders.vozvrat_po_zakazu.create";

export const ORDER_CREATE_ANY_PERMISSIONS = [
  ORDER_CREATE_PERMISSION,
  ORDER_EXCHANGE_PERMISSION,
  RETURN_SHELF_PERMISSION,
  RETURN_BY_ORDER_PERMISSION
] as const;

export const RETURN_CREATE_ANY_PERMISSIONS = [RETURN_SHELF_PERMISSION, RETURN_BY_ORDER_PERMISSION] as const;

/** `POST /orders` — `order_type` bo'yicha kerakli kalit. */
export function orderCreatePermissionForType(orderType: string | null | undefined): string {
  switch (orderType) {
    case "exchange":
      return ORDER_EXCHANGE_PERMISSION;
    case "return":
    case "partial_return":
      return RETURN_SHELF_PERMISSION;
    case "return_by_order":
      return RETURN_BY_ORDER_PERMISSION;
    default:
      return ORDER_CREATE_PERMISSION;
  }
}

/** Polki qaytarish: aniq bitta zakaz bo'yicha → «по заказу», davr / bir nechta zakaz → «с полки». */
export function returnCreatePermission(orderId: number | null | undefined): string {
  return orderId != null ? RETURN_BY_ORDER_PERMISSION : RETURN_SHELF_PERMISSION;
}
