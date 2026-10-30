import { NAV_PERM } from "@/components/dashboard/nav-permission-keys";

export type OrderCreatePageAccess = { label: string; anyOf: readonly string[] };

/** `/orders/new` — `?type=` va `?edit_order_id=` bo‘yicha sahifa ruxsati (server bilan bir xil). */
export function orderCreatePageAccess(orderType: string, editOrderId: number | null): OrderCreatePageAccess {
  switch (orderType) {
    case "return":
      return { label: "Создать возврат с полки", anyOf: NAV_PERM.returnsShelfCreate };
    case "return_by_order":
      return { label: "Создать возврат с полки по заказу", anyOf: NAV_PERM.returnsByOrderCreate };
    case "exchange":
      return { label: "Создать обмен", anyOf: NAV_PERM.exchangeCreate };
    default:
      return editOrderId != null
        ? { label: "Редактирование заказа", anyOf: ["orders.zakaz.update"] }
        : { label: "Создать заказ", anyOf: NAV_PERM.ordersCreate };
  }
}
