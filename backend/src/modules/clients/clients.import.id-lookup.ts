import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { chunkNumericIds } from "./clients.import.runtime";

/** PostgreSQL `ANY(int[])` — bitta bind; 50k+ ID uchun ham xavfsiz. */
export const IMPORT_ID_ANY_CHUNK = 50_000;

export type ImportExistingClientRow = {
  id: number;
  name: string;
  legal_name: string | null;
  phone: string | null;
  phone_normalized: string | null;
  address: string | null;
  client_code: string | null;
  client_pinfl: string | null;
  category: string | null;
  client_type_code: string | null;
  credit_limit: Prisma.Decimal;
  is_active: boolean;
  responsible_person: string | null;
  landmark: string | null;
  inn: string | null;
  pdl: string | null;
  logistics_service: string | null;
  license_until: Date | null;
  working_hours: string | null;
  region: string | null;
  district: string | null;
  city: string | null;
  neighborhood: string | null;
  zone: string | null;
  street: string | null;
  house_number: string | null;
  apartment: string | null;
  gps_text: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  notes: string | null;
  client_format: string | null;
  sales_channel: string | null;
  product_category_ref: string | null;
  contact_persons: unknown;
};

export type ImportExistingAssignmentRow = {
  client_id: number;
  slot: number;
  agent_id: number | null;
  expeditor_user_id: number | null;
  expeditor_phone: string | null;
  visit_weekdays: unknown;
};

export async function fetchImportExistingClients(
  tenantId: number,
  clientIds: number[]
): Promise<ImportExistingClientRow[]> {
  if (clientIds.length === 0) return [];
  const chunks = chunkNumericIds(clientIds, IMPORT_ID_ANY_CHUNK);
  const out: ImportExistingClientRow[] = [];
  for (const chunk of chunks) {
    const rows = await prisma.$queryRaw<ImportExistingClientRow[]>`
      SELECT
        c.id,
        c.name,
        c.legal_name,
        c.phone,
        c.phone_normalized,
        c.address,
        c.client_code,
        c.client_pinfl,
        c.category,
        c.client_type_code,
        c.credit_limit,
        c.is_active,
        c.responsible_person,
        c.landmark,
        c.inn,
        c.pdl,
        c.logistics_service,
        c.license_until,
        c.working_hours,
        c.region,
        c.district,
        c.city,
        c.neighborhood,
        c.zone,
        c.street,
        c.house_number,
        c.apartment,
        c.gps_text,
        c.latitude,
        c.longitude,
        c.notes,
        c.client_format,
        c.sales_channel,
        c.product_category_ref,
        c.contact_persons
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
        AND c.merged_into_client_id IS NULL
        AND c.id = ANY(${chunk}::int[])
    `;
    out.push(...rows);
  }
  return out;
}

export async function fetchImportExistingAssignments(
  tenantId: number,
  clientIds: number[]
): Promise<ImportExistingAssignmentRow[]> {
  if (clientIds.length === 0) return [];
  const chunks = chunkNumericIds(clientIds, IMPORT_ID_ANY_CHUNK);
  const out: ImportExistingAssignmentRow[] = [];
  for (const chunk of chunks) {
    const rows = await prisma.$queryRaw<ImportExistingAssignmentRow[]>`
      SELECT
        a.client_id,
        a.slot,
        a.agent_id,
        a.expeditor_user_id,
        a.expeditor_phone,
        a.visit_weekdays
      FROM client_agent_assignments a
      WHERE a.tenant_id = ${tenantId}
        AND a.client_id = ANY(${chunk}::int[])
      ORDER BY a.client_id ASC, a.slot ASC
    `;
    out.push(...rows);
  }
  return out;
}
