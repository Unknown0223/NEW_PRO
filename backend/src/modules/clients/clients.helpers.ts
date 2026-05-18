import { Prisma } from "@prisma/client";
import type { ClientRefEntryDto } from "../tenant-settings/tenant-settings.service";
import { salesRefStoredValue } from "../sales-directions/sales-directions.service";
import type { ClientRefOptionDto, ContactPersonSlot } from "./clients.types";

export const CONTACT_SLOTS = 10;
/** Excel import: faqat kontakt 1–2 (UI da uchinchi kontakt yo‘q). */
export const IMPORT_CONTACT_PERSON_SLOTS = 2;

export function mergeClientRefSelectOpts(
  entries: ClientRefEntryDto[],
  legacyStrings: string[],
  extraFromDb: (string | null | undefined)[]
): ClientRefOptionDto[] {
  const map = new Map<string, string>();
  for (const e of entries) {
    if (e.active === false) continue;
    const code = e.code?.trim();
    const name = e.name.trim();
    const value = code && code !== "" ? code : name;
    /** Ro‘yxatda nom ko‘rinadi; saqlanadigan qiymat — kod (yoki nom). */
    const label = name !== "" ? name : value;
    if (value) map.set(value, label);
  }
  for (const s of legacyStrings) {
    const t = s.trim();
    if (t && !map.has(t)) map.set(t, t);
  }
  for (const x of extraFromDb) {
    const t = x?.trim();
    if (t && !map.has(t)) map.set(t, t);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function mergeSalesChannelSelectOpts(
  rows: { code: string | null; name: string }[],
  legacyStrings: string[],
  extraFromDb: (string | null | undefined)[]
): ClientRefOptionDto[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    const value = salesRefStoredValue(r);
    const label = r.name.trim() || value;
    if (value) map.set(value, label);
  }
  for (const s of legacyStrings) {
    const t = s.trim();
    if (t && !map.has(t)) map.set(t, t);
  }
  for (const x of extraFromDb) {
    const t = x?.trim();
    if (t && !map.has(t)) map.set(t, t);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function mergeCitySelectOpts(
  pairs: { stored: string; name: string }[],
  legacyStrings: string[],
  extraFromDb: (string | null | undefined)[]
): ClientRefOptionDto[] {
  const map = new Map<string, string>();
  for (const { stored, name } of pairs) {
    if (stored && !map.has(stored)) map.set(stored, name);
  }
  for (const s of legacyStrings) {
    const t = s.trim();
    if (t && !map.has(t)) map.set(t, t);
  }
  for (const x of extraFromDb) {
    const t = x?.trim();
    if (t && !map.has(t)) map.set(t, t);
  }
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function parseContactPersonsJson(raw: unknown): ContactPersonSlot[] {
  const slots: ContactPersonSlot[] = Array.from({ length: CONTACT_SLOTS }, () => ({
    firstName: null,
    lastName: null,
    phone: null
  }));
  if (!Array.isArray(raw)) return slots;
  for (let i = 0; i < CONTACT_SLOTS && i < raw.length; i++) {
    const o = raw[i] as Record<string, unknown>;
    slots[i] = {
      firstName: typeof o?.firstName === "string" ? o.firstName : null,
      lastName: typeof o.lastName === "string" ? o.lastName : null,
      phone: typeof o.phone === "string" ? o.phone : null
    };
  }
  return slots;
}

export function contactPersonsToJson(slots: ContactPersonSlot[]): Prisma.InputJsonValue {
  const trimmed = slots.slice(0, CONTACT_SLOTS).map((s) => ({
    firstName: s.firstName?.trim() || null,
    lastName: s.lastName?.trim() || null,
    phone: s.phone?.trim() || null
  }));
  return trimmed as unknown as Prisma.InputJsonValue;
}

export function normalizeDistinct(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const t = v?.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "uz"));
}
