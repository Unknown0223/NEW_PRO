export type ProductCategoryListRow = {
  id: number;
  name: string;
  parent_id: number | null;
  code: string | null;
  sort_order: number | null;
  default_unit: string | null;
  is_active: boolean;
  comment: string | null;
  created_at: Date;
};
