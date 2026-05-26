export type OrderStatus = 'Новый' | 'Подтвержден' | 'Отгружен' | 'Доставлен' | 'Отменен';

export type OrderType = 'Заказ' | 'Возврат' | 'Возврат по заказу' | 'Обмен';

export interface Order {
  id: number;
  clientId: string;
  clientName: string;
  clientUuid: string;
  status: OrderStatus;
  orderType: OrderType;
  orderAmount: number;
  debt: number;
  cash: number;
  oldDebtIncome: number;
  terminal: number;
  tengeCash: number;
  bankTransfer: number;
  rial: number;
  unpaid: number;
  createdAt: string;
  hasError?: boolean;
}

export interface PaymentStatistics {
  total: number;
  received: number;
  totalDebt: number;
  remaining: number;
  cash: number;
  oldDebtIncome: number;
  terminal: number;
  tengeCash: number;
  bankTransfer: number;
  rial: number;
  unpaid: number;
}

export interface Filters {
  date: string;
  kassa: string;
  errorOnly: boolean;
}

export interface Payment {
  id: string;
  orderId: number;
  type: 'cash' | 'terminal' | 'bankTransfer' | 'rial';
  amount: number;
  comment: string;
}
