import { prisma } from "../../config/database";
import { assertOrdersInReturnFilter } from "./returns-filter.service";
import { buildReturnFilterMetaForClient } from "./returns-filter.stats";
import type { ReturnFilterMeta } from "./returns-filter.types";
import { POLKI_SOURCE_ORDER_STATUS } from "./returns-enhanced.client-data.shared";
import { listClientOrderPickBalancesWithMeta } from "./returns-enhanced.client-data";

export type ShelfReturnByOrderCheckCode =
  | "OK"
  | "BAD_CLIENT"
  | "BAD_ORDER"
  | "ORDER_NOT_DELIVERED"
  | "RETURN_FILTER_EMPTY"
  | "balance_zero_not_in_period"
  | "ORDER_OUT_OF_FILTER"
  | "ORDER_FULLY_RETURNED";

export type ShelfReturnByOrderCheckResult = {
  allowed: boolean;
  code: ShelfReturnByOrderCheckCode;
  message: string;
  filter_meta?: ReturnFilterMeta;
};

function messageForCode(code: ShelfReturnByOrderCheckCode): string {
  switch (code) {
    case "OK":
      return "";
    case "BAD_CLIENT":
      return "Клиент не найден.";
    case "BAD_ORDER":
      return "Заказ не найден или не принадлежит этому клиенту.";
    case "ORDER_NOT_DELIVERED":
      return "Возврат с полки доступен только для заказов со статусом «Доставлен».";
    case "balance_zero_not_in_period":
      return "Возврат недоступен: в настроенном периоде не было обнуления баланса клиента.";
    case "RETURN_FILTER_EMPTY":
      return "Возврат недоступен: заказ не попадает под фильтр возврата (период и баланс).";
    case "ORDER_OUT_OF_FILTER":
      return "Возврат недоступен: дата заказа вне допустимого периода по настройкам фильтра.";
    case "ORDER_FULLY_RETURNED":
      return "По этому заказу не осталось товаров для возврата с полки.";
    default:
      return "Возврат с полки по этому заказу недоступен.";
  }
}

export async function checkShelfReturnByOrderEligibility(
  tenantId: number,
  clientId: number,
  orderId: number
): Promise<ShelfReturnByOrderCheckResult> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
    select: { id: true }
  });
  if (!client) {
    return { allowed: false, code: "BAD_CLIENT", message: messageForCode("BAD_CLIENT") };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, client_id: clientId },
    select: { id: true, status: true }
  });
  if (!order) {
    return { allowed: false, code: "BAD_ORDER", message: messageForCode("BAD_ORDER") };
  }

  if (order.status !== POLKI_SOURCE_ORDER_STATUS) {
    return {
      allowed: false,
      code: "ORDER_NOT_DELIVERED",
      message: messageForCode("ORDER_NOT_DELIVERED")
    };
  }

  const { window: filterWindow, meta: filterMeta } = await buildReturnFilterMetaForClient(
    tenantId,
    clientId
  );

  if (filterWindow.empty) {
    const code =
      filterMeta.empty_reason === "balance_zero_not_in_period"
        ? "balance_zero_not_in_period"
        : "RETURN_FILTER_EMPTY";
    return {
      allowed: false,
      code,
      message: messageForCode(code),
      filter_meta: filterMeta
    };
  }

  try {
    await assertOrdersInReturnFilter(tenantId, clientId, [orderId]);
  } catch {
    return {
      allowed: false,
      code: "ORDER_OUT_OF_FILTER",
      message: messageForCode("ORDER_OUT_OF_FILTER"),
      filter_meta: filterMeta
    };
  }

  const pick = await listClientOrderPickBalancesWithMeta(tenantId, clientId);
  const hasBalance = pick.balances.some((b) => b.order_id === orderId && !b.fully_returned);
  if (!hasBalance) {
    return {
      allowed: false,
      code: "ORDER_FULLY_RETURNED",
      message: messageForCode("ORDER_FULLY_RETURNED"),
      filter_meta: pick.filter_meta ?? filterMeta
    };
  }

  return { allowed: true, code: "OK", message: "", filter_meta: pick.filter_meta ?? filterMeta };
}
