import { findImportUpdateUniqueConflicts, type ImportUpdateUniqueConflict } from "./clients.import.update-uniques";

export const CLIENT_UNIQUE_ERROR_HTTP: Record<string, { error: string; message: string }> = {
  DUPLICATE_PHONE: { error: "DuplicatePhone", message: "Этот телефон уже используется." },
  DUPLICATE_NAME: { error: "DuplicateName", message: "Клиент с таким названием уже существует." },
  DUPLICATE_CLIENT_CODE: { error: "DuplicateClientCode", message: "Этот код клиента уже занят." },
  DUPLICATE_INN: { error: "DuplicateInn", message: "Этот ИНН уже занят." },
  DUPLICATE_PINFL: { error: "DuplicatePinfl", message: "Этот ПИНФЛ уже занят." },
  DUPLICATE_CLIENT: {
    error: "DuplicateClient",
    message: "Такой клиент уже существует (территория, название, ИНН/ПИНФЛ)."
  },
  DUPLICATE_GEO_NAME: {
    error: "DuplicateGeoName",
    message: "В радиусе 100 м уже есть клиент с похожим названием."
  },
  DUPLICATE_INACTIVE: {
    error: "DuplicateInactive",
    message: "Такой клиент уже существует, но он неактивен."
  }
};

const CONFLICT_PRIORITY: ImportUpdateUniqueConflict["field"][] = [
  "phone",
  "client_code",
  "inn",
  "client_pinfl",
  "geo_name",
  "identity",
  "name"
];

export function uniqueConflictErrorCode(
  field: ImportUpdateUniqueConflict["field"]
): keyof typeof CLIENT_UNIQUE_ERROR_HTTP {
  switch (field) {
    case "phone":
      return "DUPLICATE_PHONE";
    case "client_code":
      return "DUPLICATE_CLIENT_CODE";
    case "inn":
      return "DUPLICATE_INN";
    case "client_pinfl":
      return "DUPLICATE_PINFL";
    case "identity":
      return "DUPLICATE_CLIENT";
    case "geo_name":
      return "DUPLICATE_GEO_NAME";
    default:
      return "DUPLICATE_NAME";
  }
}

export function errorCodeForUniqueConflict(
  conflict: ImportUpdateUniqueConflict
): keyof typeof CLIENT_UNIQUE_ERROR_HTTP {
  if (conflict.otherIsActive === false) return "DUPLICATE_INACTIVE";
  return uniqueConflictErrorCode(conflict.field);
}

/** Bir nechta to‘qnashuv bo‘lsa — avval aniq identifikator (telefon/kod/INN). */
export function pickPrimaryUniqueConflict(
  conflicts: ImportUpdateUniqueConflict[]
): ImportUpdateUniqueConflict | null {
  if (conflicts.length === 0) return null;
  for (const field of CONFLICT_PRIORITY) {
    const hit = conflicts.find((c) => c.field === field);
    if (hit) return hit;
  }
  return conflicts[0] ?? null;
}

export function clientUniqueHttp(msg: string): { error: string; message: string } | null {
  return CLIENT_UNIQUE_ERROR_HTTP[msg] ?? null;
}

export type ClientUniqueFields = {
  name?: string | null;
  phone?: string | null;
  phone_normalized?: string | null;
  client_code?: string | null;
  inn?: string | null;
  client_pinfl?: string | null;
  region?: string | null;
  zone?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Tenant ichida biznes-unikal: nom (+hudud), telefon, kod, INN, PINFL.
 * `excludeClientId` — yangilashda o‘zini hisobga olmaslik.
 */
export async function throwIfClientUniqueConflicts(
  tenantId: number,
  fields: ClientUniqueFields,
  excludeClientId?: number | null
): Promise<void> {
  const conflicts = await findImportUpdateUniqueConflicts(tenantId, excludeClientId ?? 0, fields);
  const primary = pickPrimaryUniqueConflict(conflicts);
  if (primary) throw new Error(errorCodeForUniqueConflict(primary));
}
