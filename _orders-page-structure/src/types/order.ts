export type OrderStatus =
  | 'NEW'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_NEW'
  | 'RETURN_SHIPPED'
  | 'RETURN_DELIVERED'
  | 'RETURN_CANCELLED'
  | 'RETURN_IN_PROGRESS';

export type OrderType = 'ORDER' | 'RETURN' | 'RETURN_BY_ORDER';

export type PaymentType = 'CASH' | 'TRANSFER' | 'CARD' | 'DEBT';

export interface OrderProduct {
  id: string;
  name: string;
  qty: number;
  price: number;
  discount: number;
  total: number;
}

export type OrderSource = 'web' | 'phone';

export interface Order {
  id: string;
  number: string;
  source?: OrderSource;
  type: OrderType;
  status: OrderStatus;
  client: string;
  clientLegalName: string;
  clientId: string;
  phone: string;
  products: OrderProduct[];
  productCount: number;
  totalQty: number;
  amount: number;
  balance: number;
  debt: number;
  paymentType: PaymentType;
  warehouse: string;
  agent: string;
  region: string;
  city: string;
  deliveryDate: string;
  expectedShipDate: string;
  shipDate: string;
  returnDate: string;
  createdAt: string;
  updatedAt: string;
  sourceOrder?: string;
  sourceRequest?: string;
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  dateType: 'order' | 'ship' | 'created';
  status: string;
  type: string;
  invoiceType: string;
  paymentType: string;
  priceType: string;
  day: string;
  clientCategory: string;
  client: string;
  productCategory: string;
  product: string;
  warehouse: string;
  agent: string;
  expediter: string;
  consignment: string;
  tradeDirection: string;
  zone: string;
  region: string;
  city: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
