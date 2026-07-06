import type { BalanceDetailColumnDef } from "./types";

export const BALANCE_DETAIL_COLUMNS: BalanceDetailColumnDef[] = [
  { key: "date", label: "Дата", visible: true, sortField: "createdAt", width: "w-[130px]", tabs: ["overall", "detailed"] },
  { key: "type", label: "Тип", visible: true, sortField: "docNumber", width: "w-[130px]", tabs: ["overall", "detailed"] },
  { key: "opName", label: "Название типа операции", visible: true, width: "w-[170px]", tabs: ["detailed"] },
  { key: "orderType", label: "Тип заказа", visible: true, width: "w-[90px]", tabs: ["detailed"] },
  { key: "consignment_d", label: "Консигнация", visible: true, width: "w-[100px]", tabs: ["detailed"] },
  { key: "debt", label: "Долг", visible: true, sortField: "debt", align: "right", width: "w-[110px]", tabs: ["overall", "detailed"] },
  { key: "payment", label: "Оплата", visible: true, sortField: "payment", align: "right", width: "w-[90px]", tabs: ["overall", "detailed"] },
  { key: "balanceAfter", label: "Баланс (после)", visible: true, align: "right", width: "w-[130px]", tabs: ["detailed"] },
  { key: "method", label: "Способ оплаты", visible: true, width: "w-[130px]", tabs: ["overall", "detailed"] },
  { key: "agent", label: "Агент", visible: true, width: "w-[200px]", tabs: ["overall", "detailed"] },
  { key: "expeditor", label: "Экспедиторы", visible: true, width: "w-[120px]", tabs: ["overall", "detailed"] },
  { key: "consignment", label: "Консигнация", visible: true, width: "w-[100px]", tabs: ["overall"] },
  { key: "cashbox", label: "Касса", visible: true, width: "w-[110px]", tabs: ["overall"] },
  { key: "comment", label: "Комментарий", visible: true, width: "min-w-[240px]", tabs: ["overall", "detailed"] },
  { key: "txComment", label: "Комментарий к транзакциям", visible: true, width: "min-w-[200px]", tabs: ["detailed"] },
  { key: "createdBy", label: "Кто создал", visible: true, width: "w-[130px]", tabs: ["overall", "detailed"] }
];
