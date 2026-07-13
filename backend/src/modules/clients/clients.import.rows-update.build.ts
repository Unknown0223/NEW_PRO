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
  readImportRefCell,
  trimImportClientCode,
  trimImportPinfl
} from "./clients.import.parse";
import { importColPresent } from "./clients.import.scalar";

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
      if (importColPresent(colIndexByKey, "legal_name")) {
        const v = readArrayCell(row, colIndexByKey.legal_name);
        if (v != null && !isPlaceholderCell(v)) data.legal_name = v.trim();
        else if (v !== null && isPlaceholderCell(String(v))) data.legal_name = null;
      }
      if (importColPresent(colIndexByKey, "phone")) {
        const v = readArrayCell(row, colIndexByKey.phone);
        if (v != null && !isPlaceholderCell(v)) {
          data.phone = v.trim();
          data.phone_normalized = normalizePhoneDigits(v);
        }
      }
      if (importColPresent(colIndexByKey, "address")) {
        const v = readArrayCell(row, colIndexByKey.address);
        if (v != null && !isPlaceholderCell(v)) data.address = v.trim();
      }
      if (importColPresent(colIndexByKey, "client_code")) {
        data.client_code = trimImportClientCode(readArrayCell(row, colIndexByKey.client_code));
      }
      if (importColPresent(colIndexByKey, "client_pinfl")) {
        data.client_pinfl = trimImportPinfl(readArrayCell(row, colIndexByKey.client_pinfl));
      }
      if (
        importColPresent(colIndexByKey, "category_code") ||
        importColPresent(colIndexByKey, "category_name") ||
        importColPresent(colIndexByKey, "category")
      ) {
        const rawC = readImportRefCell(row, colIndexByKey, ["category_code", "category_name", "category"]);
        if (rawC != null && !isPlaceholderCell(rawC)) {
          data.category = refResolver.resolveCategory(rawC);
        }
      }
      if (
        importColPresent(colIndexByKey, "client_type_code") ||
        importColPresent(colIndexByKey, "client_type_name")
      ) {
        const rawT = readImportRefCell(row, colIndexByKey, ["client_type_code", "client_type_name"]);
        if (rawT != null && !isPlaceholderCell(rawT)) {
          data.client_type_code = refResolver.resolveClientType(rawT);
        }
      }
      if (importColPresent(colIndexByKey, "credit_limit")) {
        data.credit_limit = parseCreditLimit(readArrayCell(row, colIndexByKey.credit_limit));
      }
      if (importColPresent(colIndexByKey, "is_active")) {
        const rawA = readArrayCell(row, colIndexByKey.is_active);
        if (rawA != null && !isPlaceholderCell(rawA)) data.is_active = parseIsActive(rawA);
      }
      if (importColPresent(colIndexByKey, "responsible_person")) {
        const v = readArrayCell(row, colIndexByKey.responsible_person);
        if (v != null && !isPlaceholderCell(v)) data.responsible_person = v.trim();
      }
      if (importColPresent(colIndexByKey, "landmark")) {
        const v = readArrayCell(row, colIndexByKey.landmark);
        if (v != null && !isPlaceholderCell(v)) data.landmark = v.trim();
      }
      if (importColPresent(colIndexByKey, "inn")) {
        const v = readArrayCell(row, colIndexByKey.inn);
        if (v != null && !isPlaceholderCell(v)) data.inn = v.trim();
      }
      if (importColPresent(colIndexByKey, "pdl")) {
        const v = readArrayCell(row, colIndexByKey.pdl);
        if (v != null && !isPlaceholderCell(v)) data.pdl = v.trim();
      }
      if (importColPresent(colIndexByKey, "logistics_service")) {
        const v = readArrayCell(row, colIndexByKey.logistics_service);
        if (v != null && !isPlaceholderCell(v)) data.logistics_service = v.trim();
      }
      if (importColPresent(colIndexByKey, "license_until")) {
        data.license_until = parseOptionalDate(readArrayCell(row, colIndexByKey.license_until));
      }
      if (importColPresent(colIndexByKey, "working_hours")) {
        const v = readArrayCell(row, colIndexByKey.working_hours);
        if (v != null && !isPlaceholderCell(v)) data.working_hours = v.trim();
      }
      if (importColPresent(colIndexByKey, "region")) {
        const v = readArrayCell(row, colIndexByKey.region);
        if (v != null && !isPlaceholderCell(v)) data.region = v.trim();
      }
      if (importColPresent(colIndexByKey, "district")) {
        const v = readArrayCell(row, colIndexByKey.district);
        if (v != null && !isPlaceholderCell(v)) data.district = v.trim();
      }
      if (importColPresent(colIndexByKey, "city") || importColPresent(colIndexByKey, "city_code")) {
        const cityRaw =
          readArrayCell(row, colIndexByKey.city_code) ?? readArrayCell(row, colIndexByKey.city);
        if (cityRaw != null && !isPlaceholderCell(cityRaw)) {
          data.city = refResolver.resolveCity(cityRaw);
        }
      }
      if (importColPresent(colIndexByKey, "neighborhood")) {
        const v = readArrayCell(row, colIndexByKey.neighborhood);
        if (v != null && !isPlaceholderCell(v)) data.neighborhood = v.trim();
      }
      if (importColPresent(colIndexByKey, "zone")) {
        const v = readArrayCell(row, colIndexByKey.zone);
        if (v != null && !isPlaceholderCell(v)) data.zone = v.trim();
      }
      if (importColPresent(colIndexByKey, "street")) {
        const v = readArrayCell(row, colIndexByKey.street);
        if (v != null && !isPlaceholderCell(v)) data.street = v.trim();
      }
      if (importColPresent(colIndexByKey, "house_number")) {
        const v = readArrayCell(row, colIndexByKey.house_number);
        if (v != null && !isPlaceholderCell(v)) data.house_number = v.trim();
      }
      if (importColPresent(colIndexByKey, "apartment")) {
        const v = readArrayCell(row, colIndexByKey.apartment);
        if (v != null && !isPlaceholderCell(v)) data.apartment = v.trim();
      }
      if (importColPresent(colIndexByKey, "gps_text")) {
        const v = readArrayCell(row, colIndexByKey.gps_text);
        if (v != null && !isPlaceholderCell(v)) data.gps_text = v.trim();
      }
      if (importColPresent(colIndexByKey, "latitude")) {
        data.latitude = parseOptionalLatitudeImport(readArrayCell(row, colIndexByKey.latitude));
      }
      if (importColPresent(colIndexByKey, "longitude")) {
        data.longitude = parseOptionalLongitudeImport(readArrayCell(row, colIndexByKey.longitude));
      }
      if (importColPresent(colIndexByKey, "notes")) {
        const v = readArrayCell(row, colIndexByKey.notes);
        if (v != null && !isPlaceholderCell(v)) data.notes = v.trim();
      }
      if (
        importColPresent(colIndexByKey, "client_format_code") ||
        importColPresent(colIndexByKey, "client_format_name") ||
        importColPresent(colIndexByKey, "client_format")
      ) {
        const rawF = readImportRefCell(row, colIndexByKey, [
          "client_format_code",
          "client_format_name",
          "client_format"
        ]);
        if (rawF != null && !isPlaceholderCell(rawF)) {
          data.client_format = refResolver.resolveClientFormat(rawF);
        }
      }
      if (
        importColPresent(colIndexByKey, "sales_channel_code") ||
        importColPresent(colIndexByKey, "sales_channel_name") ||
        importColPresent(colIndexByKey, "sales_channel")
      ) {
        const rawS = readImportRefCell(row, colIndexByKey, [
          "sales_channel_code",
          "sales_channel_name",
          "sales_channel"
        ]);
        if (rawS != null && !isPlaceholderCell(rawS)) {
          data.sales_channel = refResolver.resolveSalesChannel(rawS);
        }
      }
      if (importColPresent(colIndexByKey, "product_category_ref")) {
        const rawP = readArrayCell(row, colIndexByKey.product_category_ref);
        if (rawP != null && !isPlaceholderCell(rawP)) data.product_category_ref = rawP.trim() || null;
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
        const hasMap =
          importColPresent(colIndexByKey, fnK) ||
          importColPresent(colIndexByKey, `contact${p}_lastName`) ||
          importColPresent(colIndexByKey, `contact${p}_phone`);
        if (hasMap) {
          const allowedContact =
            applySet == null ||
            applySet.has(fnK) ||
            applySet.has(`contact${p}_lastName`) ||
            applySet.has(`contact${p}_phone`);
          if (allowedContact) touchContacts = true;
        }
        slots[i] = {
          firstName: readArrayCell(row, colIndexByKey[`contact${p}_firstName`]),
          lastName: readArrayCell(row, colIndexByKey[`contact${p}_lastName`]),
          phone: readArrayCell(row, colIndexByKey[`contact${p}_phone`])
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
