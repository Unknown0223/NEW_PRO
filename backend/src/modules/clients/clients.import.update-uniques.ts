import { prisma } from "../../config/database";
import { normalizePhoneDigits } from "./clients.types";
import {
  hasAnyTerritory,
  isSameClientIdentity,
  territoryScopedNameWhere,
  type TerritoryParts
} from "./clients.unique-territory";

export type ImportUpdateUniqueConflict = {
  field: "name" | "phone" | "client_code" | "inn" | "client_pinfl" | "identity";
  value: string;
  otherClientId: number;
  otherIsActive: boolean;
};

/**
 * Yangilash/yaratish: boshqa mijoz band qilgan noyob qiymatlarni aniqlash.
 * Nom (+hudud), telefon, kod, INN, PINFL — biznes unikal (app-level).
 * `clientId <= 0` — yaratish (hech kimni exclude qilmaslik).
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
    region?: string | null;
    zone?: string | null;
    city?: string | null;
  }
): Promise<ImportUpdateUniqueConflict[]> {
  const conflicts: ImportUpdateUniqueConflict[] = [];
  const exclude = clientId > 0 ? { id: { not: clientId } } : {};
  const territory: TerritoryParts = {
    region: patch.region,
    zone: patch.zone,
    city: patch.city
  };

  const name = patch.name != null ? String(patch.name).trim() : "";
  if (name) {
    const territoryFilter = hasAnyTerritory(territory) ? territoryScopedNameWhere(territory) : {};
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        ...exclude,
        name: { equals: name, mode: "insensitive" },
        ...territoryFilter
      },
      select: {
        id: true,
        is_active: true,
        name: true,
        inn: true,
        client_pinfl: true,
        region: true,
        zone: true,
        city: true
      }
    });
    if (hit) {
      const identity = isSameClientIdentity(
        { name, inn: patch.inn, client_pinfl: patch.client_pinfl, ...territory },
        {
          name: hit.name,
          inn: hit.inn,
          client_pinfl: hit.client_pinfl,
          region: hit.region,
          zone: hit.zone,
          city: hit.city
        }
      );
      if (identity) {
        conflicts.push({
          field: "identity",
          value: name,
          otherClientId: hit.id,
          otherIsActive: hit.is_active
        });
      } else {
        conflicts.push({ field: "name", value: name, otherClientId: hit.id, otherIsActive: hit.is_active });
      }
    }
  }

  const phoneNorm =
    patch.phone_normalized?.replace(/\D/g, "") ||
    (patch.phone != null ? normalizePhoneDigits(String(patch.phone)) : null);
  if (phoneNorm && phoneNorm.length >= 7) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        ...exclude,
        phone_normalized: phoneNorm
      },
      select: { id: true, is_active: true }
    });
    if (hit) conflicts.push({ field: "phone", value: phoneNorm, otherClientId: hit.id, otherIsActive: hit.is_active });
  }

  const code = patch.client_code != null ? String(patch.client_code).trim() : "";
  if (code) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        ...exclude,
        client_code: { equals: code, mode: "insensitive" }
      },
      select: { id: true, is_active: true }
    });
    if (hit) conflicts.push({ field: "client_code", value: code, otherClientId: hit.id, otherIsActive: hit.is_active });
  }

  const inn = patch.inn != null ? String(patch.inn).trim() : "";
  if (inn) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        ...exclude,
        inn: { equals: inn, mode: "insensitive" }
      },
      select: { id: true, is_active: true }
    });
    if (hit) conflicts.push({ field: "inn", value: inn, otherClientId: hit.id, otherIsActive: hit.is_active });
  }

  const pinfl = patch.client_pinfl != null ? String(patch.client_pinfl).trim() : "";
  if (pinfl) {
    const hit = await prisma.client.findFirst({
      where: {
        tenant_id: tenantId,
        merged_into_client_id: null,
        ...exclude,
        client_pinfl: { equals: pinfl, mode: "insensitive" }
      },
      select: { id: true, is_active: true }
    });
    if (hit) conflicts.push({ field: "client_pinfl", value: pinfl, otherClientId: hit.id, otherIsActive: hit.is_active });
  }

  return conflicts;
}
