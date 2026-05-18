import { Prisma } from "@prisma/client";
import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";
import { parseVisitWeekdaysJson } from "./clients.types";
import { parseContactPersonsJson } from "./clients.helpers";

export function importColPresent(colIndexByKey: Record<string, number>, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(colIndexByKey, field);
}

export function normalizeImportContactSlots(raw: unknown): ContactPersonSlot[] {
  return parseContactPersonsJson(raw).map((s) => ({
    firstName: s.firstName?.trim() || null,
    lastName: s.lastName?.trim() || null,
    phone: s.phone?.trim() || null
  }));
}

export function normalizeImportDateIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

export function normalizeImportDecimalString(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Prisma.Decimal) return v.toString();
  const t = String(v).trim();
  return t ? t : null;
}

export function filterUnchangedImportScalarData(
  data: Prisma.ClientUpdateInput,
  existing: {
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
  }
): Prisma.ClientUpdateInput {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data) as Array<[keyof Prisma.ClientUpdateInput, unknown]>) {
    if (k === "credit_limit") {
      if (normalizeImportDecimalString(v) !== existing.credit_limit.toString()) next[k] = v;
      continue;
    }
    if (k === "latitude") {
      if (normalizeImportDecimalString(v) !== normalizeImportDecimalString(existing.latitude)) next[k] = v;
      continue;
    }
    if (k === "longitude") {
      if (normalizeImportDecimalString(v) !== normalizeImportDecimalString(existing.longitude)) next[k] = v;
      continue;
    }
    if (k === "license_until") {
      if (normalizeImportDateIso(v as Date | null | undefined) !== normalizeImportDateIso(existing.license_until)) {
        next[k] = v;
      }
      continue;
    }
    if (k === "contact_persons") {
      const incoming = normalizeImportContactSlots(v);
      const current = normalizeImportContactSlots(existing.contact_persons);
      if (JSON.stringify(incoming) !== JSON.stringify(current)) {
        next[k] = v;
      }
      continue;
    }
    if (k === "phone_normalized") {
      const incoming = (v as string | null | undefined) ?? null;
      if (incoming !== existing.phone_normalized) next[k] = v;
      continue;
    }
    const current = (existing as Record<string, unknown>)[k as string];
    if ((v ?? null) !== (current ?? null)) {
      next[k] = v;
    }
  }
  return next as Prisma.ClientUpdateInput;
}

export type ExistingImportAssignmentRow = {
  slot: number;
  agent_id: number | null;
  expeditor_user_id: number | null;
  expeditor_phone: string | null;
  visit_weekdays: unknown;
};

export function normalizeExistingImportAssignments(rows: ExistingImportAssignmentRow[]): Array<{
  slot: number;
  agent_id: number | null;
  expeditor_user_id: number | null;
  expeditor_phone: string | null;
  visit_weekdays: number[];
}> {
  return rows
    .map((r) => ({
      slot: r.slot,
      agent_id: r.agent_id ?? null,
      expeditor_user_id: r.expeditor_user_id ?? null,
      expeditor_phone: r.expeditor_phone?.trim() || null,
      visit_weekdays: parseVisitWeekdaysJson(r.visit_weekdays)
    }))
    .filter(
      (r) =>
        r.agent_id != null ||
        r.expeditor_user_id != null ||
        r.expeditor_phone != null ||
        r.visit_weekdays.length > 0
    )
    .sort((a, b) => a.slot - b.slot);
}

export function normalizeIncomingImportAssignments(raw: AgentAssignmentPatch[]): Array<{
  slot: number;
  agent_id: number | null;
  expeditor_user_id: number | null;
  expeditor_phone: string | null;
  visit_weekdays: number[];
}> {
  return raw
    .map((r) => ({
      slot: r.slot,
      agent_id: r.agent_id ?? null,
      expeditor_user_id: r.expeditor_user_id ?? null,
      expeditor_phone: r.expeditor_phone?.trim() || null,
      visit_weekdays: parseVisitWeekdaysJson(r.visit_weekdays)
    }))
    .filter(
      (r) =>
        r.agent_id != null ||
        r.expeditor_user_id != null ||
        r.expeditor_phone != null ||
        r.visit_weekdays.length > 0
    )
    .sort((a, b) => a.slot - b.slot);
}

export function importAssignmentsEqual(
  a: Array<{
    slot: number;
    agent_id: number | null;
    expeditor_user_id: number | null;
    expeditor_phone: string | null;
    visit_weekdays: number[];
  }>,
  b: Array<{
    slot: number;
    agent_id: number | null;
    expeditor_user_id: number | null;
    expeditor_phone: string | null;
    visit_weekdays: number[];
  }>
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
