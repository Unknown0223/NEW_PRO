import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { normalizePhoneDigits } from "./clients.types";
import {
  IMPORT_CONTACT_PERSON_SLOTS,
  contactPersonsToJson
} from "./clients.helpers";
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
import type { ContactPersonSlot } from "./clients.types";

/** Yangi/upsert create yo‘li uchun Excel qatoridan scalar maydonlar. */
export function buildImportCreateRowScalar(
  nameTrimmed: string,
  row: unknown[],
  colIndexByKey: Record<string, number>,
  refResolver: ClientImportRefResolver
) {
  const legal_name = readArrayCell(row, colIndexByKey.legal_name);
  const phone = readArrayCell(row, colIndexByKey.phone);
  const address = readArrayCell(row, colIndexByKey.address);
  const client_code = trimImportClientCode(readArrayCell(row, colIndexByKey.client_code));
  const client_pinfl = trimImportPinfl(readArrayCell(row, colIndexByKey.client_pinfl));
  const category = refResolver.resolveCategory(
    readImportRefCell(row, colIndexByKey, ["category_code", "category_name", "category"])
  );
  const client_type_code = refResolver.resolveClientType(
    readImportRefCell(row, colIndexByKey, ["client_type_code", "client_type_name"])
  );
  const credit_limit = parseCreditLimit(readArrayCell(row, colIndexByKey.credit_limit));
  const is_active = parseIsActive(readArrayCell(row, colIndexByKey.is_active));
  const responsible_person = readArrayCell(row, colIndexByKey.responsible_person);
  const landmark = readArrayCell(row, colIndexByKey.landmark);
  const inn = readArrayCell(row, colIndexByKey.inn);
  const pdl = readArrayCell(row, colIndexByKey.pdl);
  const logistics_service = readArrayCell(row, colIndexByKey.logistics_service);
  const license_until = parseOptionalDate(readArrayCell(row, colIndexByKey.license_until));
  const working_hours = readArrayCell(row, colIndexByKey.working_hours);
  const region = readArrayCell(row, colIndexByKey.region);
  const district = readArrayCell(row, colIndexByKey.district);
  const cityRaw =
    readArrayCell(row, colIndexByKey.city_code) ?? readArrayCell(row, colIndexByKey.city);
  const city = refResolver.resolveCity(cityRaw);
  const neighborhood = readArrayCell(row, colIndexByKey.neighborhood);
  const zone = readArrayCell(row, colIndexByKey.zone);
  const street = readArrayCell(row, colIndexByKey.street);
  const house_number = readArrayCell(row, colIndexByKey.house_number);
  const apartment = readArrayCell(row, colIndexByKey.apartment);
  const gps_text = readArrayCell(row, colIndexByKey.gps_text);
  const latitude = parseOptionalLatitudeImport(readArrayCell(row, colIndexByKey.latitude));
  const longitude = parseOptionalLongitudeImport(readArrayCell(row, colIndexByKey.longitude));
  const notes = readArrayCell(row, colIndexByKey.notes);
  const client_format = refResolver.resolveClientFormat(
    readImportRefCell(row, colIndexByKey, [
      "client_format_code",
      "client_format_name",
      "client_format"
    ])
  );
  const sales_channel = refResolver.resolveSalesChannel(
    readImportRefCell(row, colIndexByKey, [
      "sales_channel_code",
      "sales_channel_name",
      "sales_channel"
    ])
  );
  const product_category_refRaw = readArrayCell(row, colIndexByKey.product_category_ref);
  const product_category_ref =
    product_category_refRaw != null && !isPlaceholderCell(product_category_refRaw)
      ? product_category_refRaw.trim() || null
      : null;

  const slots: ContactPersonSlot[] = Array.from({ length: IMPORT_CONTACT_PERSON_SLOTS }, () => ({
    firstName: null,
    lastName: null,
    phone: null
  }));
  for (let i = 0; i < IMPORT_CONTACT_PERSON_SLOTS; i++) {
    const p = i + 1;
    slots[i] = {
      firstName: readArrayCell(row, colIndexByKey[`contact${p}_firstName`]),
      lastName: readArrayCell(row, colIndexByKey[`contact${p}_lastName`]),
      phone: readArrayCell(row, colIndexByKey[`contact${p}_phone`])
    };
  }

  const phoneNormalized = normalizePhoneDigits(phone);
  const cityNorm =
    city != null && String(city).trim()
      ? String(city).trim().toLocaleLowerCase("ru-RU")
      : null;

  const scalarData = {
    name: nameTrimmed,
    legal_name,
    phone,
    phone_normalized: phoneNormalized,
    address,
    client_code,
    client_pinfl,
    category,
    client_type_code,
    credit_limit,
    is_active,
    responsible_person,
    landmark,
    inn,
    pdl,
    logistics_service,
    license_until,
    working_hours,
    region,
    district,
    city,
    neighborhood,
    zone,
    street,
    house_number,
    apartment,
    gps_text,
    latitude,
    longitude,
    notes,
    client_format,
    sales_channel,
    product_category_ref,
    contact_persons: contactPersonsToJson(slots)
  };

  return {
    scalarData,
    client_code,
    client_pinfl,
    inn,
    city,
    phoneNormalized,
    cityNorm
  };
}
