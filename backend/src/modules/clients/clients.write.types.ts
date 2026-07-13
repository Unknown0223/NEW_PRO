import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  applyTerritoryAutoAssignAfterAddressChange,
  clientUpdateTouchesAddress
} from "../work-slots/work-slots.territory-auto";
import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";
import { normalizePhoneDigits } from "./clients.types";
import { CONTACT_SLOTS, contactPersonsToJson } from "./clients.helpers";
import {
  replaceClientAgentAssignments,
  syncAssignmentSlotOneWithClientRow
} from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import type { ClientDetailRow } from "./clients.detail";
import { getClientDetail } from "./clients.detail";

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
  contact_persons?: ContactPersonSlot[];
  is_active?: boolean;
  price_type?: string | null;
  allow_order_with_debt?: boolean;
  allow_consignment?: boolean;
  allow_consignment_with_debt?: boolean;
};

function parseOptionalLatitude(v: string | number | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < -90 || n > 90) throw new Error("VALIDATION");
  return new Prisma.Decimal(s);
}

function parseOptionalLongitude(v: string | number | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < -180 || n > 180) throw new Error("VALIDATION");
  return new Prisma.Decimal(s);
}


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
};

/** Minimal yangi mijoz (keyin to‘liq tahrir sahifasida to‘ldiriladi). */
