import { z } from "zod";

export const GPS_DELIVERY_EXPORT_CAP = 5000;

export type GpsDeliveryRoutesFilters = {
  from: string;
  to: string;
  branch_names: string[];
  expeditor_ids: number[];
  /** Faqat mobil ilova ruxsati borlar (`app_access=true`) */
  app_users_only: boolean;
  search?: string;
  page: number;
  limit: number;
};

export type GpsDeliveryRouteRow = {
  row_number: number;
  expeditor_id: number;
  expeditor_name: string;
  expeditor_code: string;
  branch: string | null;
  app_access: boolean;
  /** soniya */
  actual_time_sec: number;
  calculated_time_sec: number;
  /** metr */
  calculated_route_m: number;
  expected_route_m: number;
  expected_time_sec: number;
  visits_count: number;
  at_point: number;
  outside_point: number;
};

export const gpsDeliveryRoutesQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branch_names: z.string().optional(),
  expeditor_ids: z.string().optional(),
  app_users_only: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});
