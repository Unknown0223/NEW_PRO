import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";

export type UpdateClientInput = {
  name?: string;
  legal_name?: string | null;
  phone?: string | null;
  credit_limit?: number;
  address?: string | null;
  category?: string | null;
  client_type_code?: string | null;
  responsible_person?: string | null;
  landmark?: string | null;
  inn?: string | null;
  pdl?: string | null;
  logistics_service?: string | null;
  license_until?: string | null;
  working_hours?: string | null;
  region?: string | null;
  district?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  house_number?: string | null;
  apartment?: string | null;
  gps_text?: string | null;
  visit_date?: string | null;
  notes?: string | null;
  client_format?: string | null;
  client_code?: string | null;
  sales_channel?: string | null;
  product_category_ref?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_mfo?: string | null;
  client_pinfl?: string | null;
  oked?: string | null;
  contract_number?: string | null;
  vat_reg_code?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  zone?: string | null;
  warehouse_id?: number | null;
  cash_desk_id?: number | null;
  agent_id?: number | null;
  agent_assignments?: AgentAssignmentPatch[];
  agent_assignments_merge?: boolean;
  contact_persons?: ContactPersonSlot[];
  is_active?: boolean;
  price_type?: string | null;
  allow_order_with_debt?: boolean;
  allow_consignment?: boolean;
  allow_consignment_with_debt?: boolean;
  /** Agent mobil tahriri: manzil o‘zgaganda territory auto agentni yeb qo‘ymasın. */
  skip_territory_auto_assign?: boolean;
};

export type CreateClientMinimalInput = {
  name: string;
  phone?: string | null;
  category?: string | null;
  client_type_code?: string | null;
  region?: string | null;
  district?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  zone?: string | null;
  client_format?: string | null;
  sales_channel?: string | null;
  product_category_ref?: string | null;
  logistics_service?: string | null;
  /** Yaratishdan oldin unikal tekshiruv (insert qilinmaydi — keyin update). */
  inn?: string | null;
  client_code?: string | null;
  client_pinfl?: string | null;
  /** Agent ilovasidan: hudud avto-biriktirish yaratuvchini yemasin. */
  skipTerritoryAutoAssign?: boolean;
  /** Agent: «Подтверждение нового клиента» yoqilgan bo‘lsa true. */
  is_active?: boolean;
};
