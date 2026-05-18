export type KpiProductPreview = { id: number; name: string; sku: string };
export type KpiAgentPreview = { id: number; fio: string; code: string | null };

export type KpiGroupListRow = {
  id: number;
  name: string;
  code: string | null;
  sort_order: number;
  comment: string | null;
  is_active: boolean;
  products: KpiProductPreview[];
  agents: KpiAgentPreview[];
  product_total: number;
  agent_total: number;
};

export type KpiGroupDetailRow = {
  id: number;
  name: string;
  code: string | null;
  sort_order: number;
  comment: string | null;
  is_active: boolean;
  product_ids: number[];
  agent_user_ids: number[];
};
