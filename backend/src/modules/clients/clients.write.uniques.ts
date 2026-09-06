import { findImportUpdateUniqueConflicts, type ImportUpdateUniqueConflict } from "./clients.import.update-uniques";

export const CLIENT_UNIQUE_ERROR_HTTP: Record<string, { error: string; message: string }> = {
  DUPLICATE_PHONE: { error: "DuplicatePhone", message: "Bu telefon mavjud." },
  DUPLICATE_NAME: { error: "DuplicateName", message: "Shu nomga mijoz mavjud." },
  DUPLICATE_CLIENT_CODE: { error: "DuplicateClientCode", message: "Bu klient kodi band." },
  DUPLICATE_INN: { error: "DuplicateInn", message: "Bu STIR (INN) band." },
  DUPLICATE_PINFL: { error: "DuplicatePinfl", message: "Bu JSHSHIR (PINFL) band." },
  DUPLICATE_CLIENT: {
    error: "DuplicateClient",
    message: "Bu mijoz allaqachon mavjud (hudud, nom, INN/PINFL)."
  },
  DUPLICATE_INACTIVE: {
    error: "DuplicateInactive",
    message: "Bu klient allaqachon mavjud, statusi nofaol."
  }
};

const CONFLICT_PRIORITY: ImportUpdateUniqueConflict["field"][] = [
  "phone",
  "client_code",
  "inn",
  "client_pinfl",
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
