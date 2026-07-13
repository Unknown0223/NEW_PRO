import { Prisma } from "@prisma/client";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { filterClientUpdateInputByApplyFields } from "./client-import-masks";
import { normalizePhoneDigits } from "./clients.types";
import { IMPORT_CONTACT_PERSON_SLOTS, contactPersonsToJson } from "./clients.helpers";
import type { ContactPersonSlot } from "./clients.types";
import {
  isPlaceholderCell,
  parseCreditLimit,
  parseIsActive,
  parseOptionalDate,
  parseOptionalLatitudeImport,
  parseOptionalLongitudeImport,
  readArrayCell,
  readMappedCell,
  readMappedRefCell,
  trimImportClientCode,
  trimImportPinfl
} from "./clients.import.parse";
import { importColPresent } from "./clients.import.scalar";

function applyMappedNullableText(
  data: Prisma.ClientUpdateInput,
  field: keyof Prisma.ClientUpdateInput,
  row: unknown[],
  colIndexByKey: Record<string, number>,
  key: string
) {
  const raw = readMappedCell(row, colIndexByKey, key);
  if (raw === undefined) return;
  if (raw != null && !isPlaceholderCell(raw)) {
    (data as Record<string, unknown>)[field as string] = raw.trim();
  } else {
    (data as Record<string, unknown>)[field as string] = null;
  }
}

function applyMappedRefField(
  data: Prisma.ClientUpdateInput,
  field: keyof Prisma.ClientUpdateInput,
  row: unknown[],
  colIndexByKey: Record<string, number>,
  keys: string[],
  resolve: (raw: string | null) => string | null
) {
  const raw = readMappedRefCell(row, colIndexByKey, keys);
  if (raw === undefined) return;
  if (raw != null && !isPlaceholderCell(raw)) {
    (data as Record<string, unknown>)[field as string] = resolve(raw);
  } else {
    (data as Record<string, unknown>)[field as string] = null;
  }
}

export function buildImportUpdateScalarData(
  row: unknown[],
  colIndexByKey: Record<string, number>,
  refResolver: ClientImportRefResolver,
  applySet: Set<string> | null
): Prisma.ClientUpdateInput {
  let data: Prisma.ClientUpdateInput = {};
      if (importColPresent(colIndexByKey, "name")) {
        const v = readArrayCell(row, colIndexByKey.name);
        if (v != null && !isPlaceholderCell(v)) data.name = v.trim();
      }
      applyMappedNullableText(data, "legal_name", row, colIndexByKey, "legal_name");
      if (readMappedCell(row, colIndexByKey, "phone") !== undefined) {
        const v = readMappedCell(row, colIndexByKey, "phone");
        if (v != null && !isPlaceholderCell(v)) {
          data.phone = v.trim();
          data.phone_normalized = normalizePhoneDigits(v);
        } else {
          data.phone = null;
          data.phone_normalized = null;
        }
      }
      applyMappedNullableText(data, "address", row, colIndexByKey, "address");
      if (readMappedCell(row, colIndexByKey, "client_code") !== undefined) {
        data.client_code = trimImportClientCode(readArrayCell(row, colIndexByKey.client_code));
      }
      if (readMappedCell(row, colIndexByKey, "client_pinfl") !== undefined) {
        data.client_pinfl = trimImportPinfl(readArrayCell(row, colIndexByKey.client_pinfl));
      }
      applyMappedRefField(data, "category", row, colIndexByKey, [
        "category_code",
        "category_name",
        "category"
      ], (raw) => refResolver.resolveCategory(raw));
      applyMappedRefField(data, "client_type_code", row, colIndexByKey, [
        "client_type_code",
        "client_type_name"
      ], (raw) => refResolver.resolveClientType(raw));
      if (readMappedCell(row, colIndexByKey, "credit_limit") !== undefined) {
        data.credit_limit = parseCreditLimit(readArrayCell(row, colIndexByKey.credit_limit));
      }
      if (readMappedCell(row, colIndexByKey, "is_active") !== undefined) {
        const rawA = readArrayCell(row, colIndexByKey.is_active);
        if (rawA != null && !isPlaceholderCell(rawA)) data.is_active = parseIsActive(rawA);
      }
      applyMappedNullableText(data, "responsible_person", row, colIndexByKey, "responsible_person");
      applyMappedNullableText(data, "landmark", row, colIndexByKey, "landmark");
      applyMappedNullableText(data, "inn", row, colIndexByKey, "inn");
      applyMappedNullableText(data, "pdl", row, colIndexByKey, "pdl");
      applyMappedNullableText(data, "logistics_service", row, colIndexByKey, "logistics_service");
      if (readMappedCell(row, colIndexByKey, "license_until") !== undefined) {
        data.license_until = parseOptionalDate(readArrayCell(row, colIndexByKey.license_until));
      }
      applyMappedNullableText(data, "working_hours", row, colIndexByKey, "working_hours");
      applyMappedNullableText(data, "region", row, colIndexByKey, "region");
      applyMappedNullableText(data, "district", row, colIndexByKey, "district");
      applyMappedRefField(
        data,
        "city",
        row,
        colIndexByKey,
        ["city_code", "city"],
        (raw) => refResolver.resolveCity(raw)
      );
      applyMappedNullableText(data, "neighborhood", row, colIndexByKey, "neighborhood");
      applyMappedNullableText(data, "zone", row, colIndexByKey, "zone");
      applyMappedNullableText(data, "street", row, colIndexByKey, "street");
      applyMappedNullableText(data, "house_number", row, colIndexByKey, "house_number");
      applyMappedNullableText(data, "apartment", row, colIndexByKey, "apartment");
      applyMappedNullableText(data, "gps_text", row, colIndexByKey, "gps_text");
      if (readMappedCell(row, colIndexByKey, "latitude") !== undefined) {
        data.latitude = parseOptionalLatitudeImport(readArrayCell(row, colIndexByKey.latitude));
      }
      if (readMappedCell(row, colIndexByKey, "longitude") !== undefined) {
        data.longitude = parseOptionalLongitudeImport(readArrayCell(row, colIndexByKey.longitude));
      }
      applyMappedNullableText(data, "notes", row, colIndexByKey, "notes");
      applyMappedRefField(
        data,
        "client_format",
        row,
        colIndexByKey,
        ["client_format_code", "client_format_name", "client_format"],
        (raw) => refResolver.resolveClientFormat(raw)
      );
      applyMappedRefField(
        data,
        "sales_channel",
        row,
        colIndexByKey,
        ["sales_channel_code", "sales_channel_name", "sales_channel"],
        (raw) => refResolver.resolveSalesChannel(raw)
      );
      if (readMappedCell(row, colIndexByKey, "product_category_ref") !== undefined) {
        const rawP = readArrayCell(row, colIndexByKey.product_category_ref);
        data.product_category_ref =
          rawP != null && !isPlaceholderCell(rawP) ? rawP.trim() || null : null;
      }

      const slots: ContactPersonSlot[] = Array.from({ length: IMPORT_CONTACT_PERSON_SLOTS }, () => ({
        firstName: null,
        lastName: null,
        phone: null
      }));
      let touchContacts = false;
      for (let i = 0; i < IMPORT_CONTACT_PERSON_SLOTS; i++) {
        const p = i + 1;
        const fnK = `contact${p}_firstName`;
        const lnK = `contact${p}_lastName`;
        const phK = `contact${p}_phone`;
        const fnRaw = readMappedCell(row, colIndexByKey, fnK);
        const lnRaw = readMappedCell(row, colIndexByKey, lnK);
        const phRaw = readMappedCell(row, colIndexByKey, phK);
        if (fnRaw === undefined && lnRaw === undefined && phRaw === undefined) continue;
        const allowedContact =
          applySet == null || applySet.has(fnK) || applySet.has(lnK) || applySet.has(phK);
        if (!allowedContact) continue;
        touchContacts = true;
        const toContactValue = (raw: string | null | undefined) => {
          if (raw === undefined) return undefined;
          if (raw != null && !isPlaceholderCell(raw)) return raw.trim() || null;
          return null;
        };
        const fn = toContactValue(fnRaw);
        const ln = toContactValue(lnRaw);
        const ph = toContactValue(phRaw);
        slots[i] = {
          firstName: fn !== undefined ? fn : slots[i].firstName,
          lastName: ln !== undefined ? ln : slots[i].lastName,
          phone: ph !== undefined ? ph : slots[i].phone
        };
      }
      if (touchContacts) {
        data.contact_persons = contactPersonsToJson(slots);
      }
      if (applySet != null) {
        data = filterClientUpdateInputByApplyFields(data, applySet);
      }
  return data;
}
