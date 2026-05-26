/** GET `/payments/order-cash-in/context` — backend DTO */
export type OrderCashInPaymentMethod = {
  id: string;
  name: string;
  code: string | null;
  payment_type: string;
  currency_code: string;
  color: string | null;
  sort_order: number | null;
};

export type OrderCashInContextOrder = {
  id: number;
  client_id: number;
  client_name: string;
  status: string;
  order_amount: string;
  debt: string | null;
  existing_by_type: Record<string, string>;
};

export type OrderCashInContext = {
  client: { id: number; name: string };
  payment_methods: OrderCashInPaymentMethod[];
  orders: OrderCashInContextOrder[];
};

export type PaymentOrderRow = {
  id: number;
  clientId: number;
  clientName: string;
  status: string;
  orderAmount: number;
  debt: number;
  /** Mavjud to‘lovlar (payment_type → summa) */
  existingByType: Record<string, number>;
  /** Yangi kiritilayotgan to‘lovlar (payment_method.id → summa) */
  draftByMethodId: Record<string, number>;
  unpaid: number;
  hasError?: boolean;
};

export type PaymentStatistics = {
  total: number;
  received: number;
  totalDebt: number;
  remaining: number;
  unpaid: number;
};

export type OrderPaymentFilters = {
  paidAtLocal: string;
  cashDeskId: string;
  errorOnly: boolean;
};
