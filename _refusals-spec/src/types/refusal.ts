export type RefusalReason =
  | 'stock_enough'
  | 'client_closed'
  | 'no_money'
  | 'competitor'
  | 'later';

export interface Refusal {
  id: string;
  client: {
    id: string;
    name: string;
  };
  agent: {
    id: string;
    code: string;
    name: string;
  };
  reason: RefusalReason;
  territory: string;
  createdAt: string; // ISO date string
  comment?: string;
}

export interface RefusalFiltersState {
  dateFrom: string;
  dateTo: string;
  agent: string;
  reason: string;
  clientCategory: string;
  zone: string;
  region: string;
  city: string;
}

export interface PaginationState {
  page: number;
  perPage: number;
  total: number;
}
