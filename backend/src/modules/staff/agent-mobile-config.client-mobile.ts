import type { AgentMobileClientConfig, ClientFieldKey } from "./agent-mobile-config.types";

export type MobileClientInput = {
  name: string;
  phone: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  legal_name?: string | null;
  inn?: string | null;
  category?: string | null;
  sales_channel?: string | null;
  client_type_code?: string | null;
  region?: string | null;
  zone?: string | null;
  city?: string | null;
  visit_date?: string | null;
  client_code?: string | null;
  bank_name?: string | null;
  bank_mfo?: string | null;
  oked?: string | null;
  client_pinfl?: string | null;
  contract_number?: string | null;
  visit_weekdays?: number[];
};

/** Config `fields_visible` / `fields_required` kalitlari → API body kalitlari. */
const CONFIG_FIELD_TO_INPUT: { field: ClientFieldKey; key: keyof MobileClientInput }[] = [
  { field: "legal_name", key: "legal_name" },
  { field: "inn", key: "inn" },
  { field: "category", key: "category" },
  { field: "sales_channel", key: "sales_channel" },
  { field: "client_type", key: "client_type_code" },
  { field: "territory", key: "region" },
  { field: "address", key: "address" },
  { field: "visit_day", key: "visit_date" },
  { field: "client_pc", key: "client_code" },
  { field: "bank", key: "bank_name" },
  { field: "mfo", key: "bank_mfo" },
  { field: "oked", key: "oked" },
  { field: "pinfl", key: "client_pinfl" },
  { field: "agreement_number", key: "contract_number" },
  { field: "notes", key: "notes" }
];

function fieldVisible(cfg: AgentMobileClientConfig | undefined, key: ClientFieldKey): boolean {
  const v = cfg?.fields_visible;
  if (!v || Object.keys(v).length === 0) {
    return key === "name" || key === "phone" || key === "address";
  }
  return v[key] === true;
}

const DIGITS_ONLY = /^\d+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function assertFieldFormat(field: ClientFieldKey, val: string | null | undefined): void {
  if (val == null || String(val).trim() === "") return;
  const s = String(val).trim();
  switch (field) {
    case "phone": {
      const d = s.replace(/\D/g, "");
      if (d.length < 9) throw new Error("VALIDATION");
      break;
    }
    case "inn":
      if (!DIGITS_ONLY.test(s) || s.length !== 9) throw new Error("VALIDATION");
      break;
    case "pinfl":
      if (!DIGITS_ONLY.test(s) || s.length !== 14) throw new Error("VALIDATION");
      break;
    case "mfo":
    case "oked":
      if (!DIGITS_ONLY.test(s) || s.length !== 5) throw new Error("VALIDATION");
      break;
    case "visit_day":
      if (!DATE_ONLY.test(s)) throw new Error("VALIDATION");
      break;
    case "name":
      if (s.length < 3 || s.length > 255) throw new Error("VALIDATION");
      break;
    default:
      break;
  }
}

function fieldRequired(cfg: AgentMobileClientConfig | undefined, key: ClientFieldKey): boolean {
  return cfg?.fields_required?.[key] === true;
}

function assertRequiredValue(val: unknown): boolean {
  if (val == null) return false;
  return String(val).trim() !== "";
}

export function assertMobileClientPolicy(
  cfg: AgentMobileClientConfig | undefined,
  input: MobileClientInput,
  mode: "create" | "patch"
): void {
  if (mode === "create" && cfg?.can_create === false) {
    throw new Error("CLIENT_CREATE_FORBIDDEN");
  }

  if (mode === "create") {
    const name = input.name?.trim() ?? "";
    if (name.length < 3) throw new Error("VALIDATION");
    const phone = input.phone?.trim() ?? "";
    if (phone.length < 5) throw new Error("VALIDATION");
  } else {
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 1) throw new Error("VALIDATION");
    }
  }

  if (input.phone !== undefined && fieldRequired(cfg, "phone")) {
    const phone = input.phone?.trim() ?? "";
    if (phone.length < 5) throw new Error("VALIDATION");
  }

  for (const { field, key } of CONFIG_FIELD_TO_INPUT) {
    if (mode === "patch" && (input as Record<string, unknown>)[key] === undefined) continue;
    if (!fieldRequired(cfg, field)) continue;
    const val = (input as Record<string, unknown>)[key];
    if (!assertRequiredValue(val)) throw new Error("VALIDATION");
    assertFieldFormat(field, val as string);
  }

  for (const { field, key } of CONFIG_FIELD_TO_INPUT) {
    if (mode === "patch" && (input as Record<string, unknown>)[key] === undefined) continue;
    const val = (input as Record<string, unknown>)[key];
    if (val == null || String(val).trim() === "") continue;
    assertFieldFormat(field, val as string);
  }

  assertFieldFormat("phone", input.phone);
  if (mode === "create") {
    assertFieldFormat("name", input.name);
  }

  if (fieldRequired(cfg, "coordinates")) {
    if (mode === "create" && (input.latitude == null || input.longitude == null)) {
      throw new Error("VALIDATION");
    }
  }

  if (cfg?.can_change_client_location === false) {
    if (input.latitude != null || input.longitude != null) {
      throw new Error("CLIENT_LOCATION_FORBIDDEN");
    }
  }
}

/** Mobil PATCH/create body → `updateClientFields` input. */
export function mobileClientInputToUpdateFields(input: MobileClientInput) {
  return {
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    notes: input.notes ?? null,
    legal_name: input.legal_name ?? null,
    inn: input.inn ?? null,
    category: input.category ?? null,
    sales_channel: input.sales_channel ?? null,
    client_type_code: input.client_type_code ?? null,
    region: input.region ?? null,
    zone: input.zone ?? null,
    city: input.city ?? null,
    visit_date: input.visit_date ?? null,
    client_code: input.client_code ?? null,
    bank_name: input.bank_name ?? null,
    bank_mfo: input.bank_mfo ?? null,
    oked: input.oked ?? null,
    client_pinfl: input.client_pinfl ?? null,
    contract_number: input.contract_number ?? null
  };
}

const PATCH_KEY_MAP: { api: keyof MobileClientInput; update: string }[] = [
  { api: "address", update: "address" },
  { api: "latitude", update: "latitude" },
  { api: "longitude", update: "longitude" },
  { api: "notes", update: "notes" },
  { api: "legal_name", update: "legal_name" },
  { api: "inn", update: "inn" },
  { api: "category", update: "category" },
  { api: "sales_channel", update: "sales_channel" },
  { api: "client_type_code", update: "client_type_code" },
  { api: "region", update: "region" },
  { api: "visit_date", update: "visit_date" },
  { api: "client_code", update: "client_code" },
  { api: "bank_name", update: "bank_name" },
  { api: "bank_mfo", update: "bank_mfo" },
  { api: "oked", update: "oked" },
  { api: "client_pinfl", update: "client_pinfl" },
  { api: "contract_number", update: "contract_number" }
];

/** PATCH — faqat yuborilgan maydonlar. */
export function mobileClientPatchToUpdateFields(patch: Partial<MobileClientInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { api, update } of PATCH_KEY_MAP) {
    if ((patch as Record<string, unknown>)[api] === undefined) continue;
    out[update] = (patch as Record<string, unknown>)[api] ?? null;
  }
  return out;
}

export function defaultVisibleClientFields(cfg: AgentMobileClientConfig | undefined): ClientFieldKey[] {
  const v = cfg?.fields_visible;
  if (!v || Object.keys(v).length === 0) return ["name", "phone"];
  return (Object.keys(v) as ClientFieldKey[]).filter((k) => v[k] === true);
}

export { fieldVisible, fieldRequired };
