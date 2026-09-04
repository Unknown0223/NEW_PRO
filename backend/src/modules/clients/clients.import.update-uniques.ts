import { prisma } from "../../config/database";
import { normalizePhoneDigits } from "./clients.types";

export type ImportUpdateUniqueConflict = {
  field: "name" | "phone" | "client_code" | "inn" | "client_pinfl";
  value: string;
  otherClientId: number;
};

/**
 * Yangilash: boshqa mijoz band qilgan noyob qiymatlarni aniqlash.
 * DB: `@@unique([tenant_id, name])`; telefon/kod/INN/PINFL — biznes unikal.
 */
export async function findImportUpdateUniqueConflicts(
  tenantId: number,
  clientId: number,
  patch: {
    name?: string | null;
    phone?: string | null;
    phone_normalized?: string | null;
    client_code?: string | null;
    inn?: string | null;
    client_pinfl?: string | null;
  }
): Promise<ImportUpdateUniqueConflict[]> {
  const conflicts: ImportUpdateUniqueConflict[] = [];

  const name = patch.name != null ? String(patch.name).trim() : "";
  if (name) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        id: { not: clientId },
        name: { equals: name, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (hit) conflicts.push({ field: "name", value: name, otherClientId: hit.id });
  }

  const phoneNorm =
    patch.phone_normalized?.replace(/\D/g, "") ||
    (patch.phone != null ? normalizePhoneDigits(String(patch.phone)) : null);
  if (phoneNorm && phoneNorm.length >= 7) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        id: { not: clientId },
        phone_normalized: phoneNorm
      },
      select: { id: true }
    });
    if (hit) conflicts.push({ field: "phone", value: phoneNorm, otherClientId: hit.id });
  }

  const code = patch.client_code != null ? String(patch.client_code).trim() : "";
  if (code) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        id: { not: clientId },
        client_code: { equals: code, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (hit) conflicts.push({ field: "client_code", value: code, otherClientId: hit.id });
  }

  const inn = patch.inn != null ? String(patch.inn).trim() : "";
  if (inn) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        id: { not: clientId },
        inn: { equals: inn, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (hit) conflicts.push({ field: "inn", value: inn, otherClientId: hit.id });
  }

  const pinfl = patch.client_pinfl != null ? String(patch.client_pinfl).trim() : "";
  if (pinfl) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        id: { not: clientId },
        client_pinfl: { equals: pinfl, mode: "insensitive" }
      },
      select: { id: true }
    });
    if (hit) conflicts.push({ field: "client_pinfl", value: pinfl, otherClientId: hit.id });
  }

  return conflicts;
}
