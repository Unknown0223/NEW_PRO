/** SalesDoc `/report/photoReport` — mijoz foto hisobotlari. */

export type PhotoReportArchive = "active" | "void" | "all";
export type PhotoReportClientActive = "all" | "active" | "inactive";

export type PhotoReportFilters = {
  from: string;
  to: string;
  photo_categories: string[];
  user_ids: number[];
  user_roles: string[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  client_active: PhotoReportClientActive;
  archive: PhotoReportArchive;
  search?: string;
  page: number;
  limit: number;
};

export type PhotoReportRow = {
  row_number: number;
  photo_id: number;
  client_id: number;
  client_code: string;
  client_name: string;
  created_at: string;
  client_category: string;
  territory: string;
  user_name: string;
  user_role: string;
  category: string;
  status_label: string;
  content_purged: boolean;
};
