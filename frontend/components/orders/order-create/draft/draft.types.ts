import type { ClientRow } from "@/lib/client-types";
import type { ProductRow } from "@/lib/product-types";

export type OrderCreateErrorTarget =
  | "client"
  | "warehouse"
  | "agent"
  | "payment"
  | "price"
  | "catalog"
  | "polki-orders"
  | "polki-lines"
  | null;

export type OrderCreateContextResponse = {
  clients: ClientRow[];
  products: ProductRow[];
  warehouses: { id: number; name: string; stock_purpose?: string; is_active?: boolean }[];
  users: { id: number; login: string; name: string; role: string }[];
  price_types: string[];
  expeditors: Array<{ id: number; fio: string; login: string; is_active: boolean }>;
  settings_profile: {
    references?: {
      request_type_entries?: unknown;
      order_note_entries?: unknown;
      refusal_reason_entries?: unknown;
      payment_types?: string[];
      payment_method_entries?: {
        id: string;
        name: string;
        active?: boolean;
        code?: string | null;
      }[];
      price_type_entries?: Array<{
        id: string;
        name: string;
        code: string | null;
        kind?: string;
        active?: boolean;
        sort_order?: number | null;
        payment_method_id?: string;
      }>;
      trade_directions?: string[];
    };
    feature_flags?: Record<string, unknown>;
  };
  product_categories: { id: number; name: string }[];
};
