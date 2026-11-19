export type DiscountDetailReportFilters = {
  from: string;
  to: string;
  agent_ids: number[];
  search?: string;
  page: number;
  limit: number;
};

export type DiscountDetailReportRow = {
  row_number: number;
  order_id: number;
  order_date: string;
  order_number: string;
  client_name: string;
  agent_name: string;
  discount_sum: string;
  total_sum: string;
  status: string;
};