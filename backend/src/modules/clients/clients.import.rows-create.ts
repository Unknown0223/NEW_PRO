import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { applyTerritoryAutoAssignAfterAddressChange } from "../work-slots/work-slots.territory-auto";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { buildDuplicateCompositeKey, duplicateKeyFromExistingRow } from "./client-import-masks";
import { normalizePhoneDigits } from "./clients.types";
import {
  CONTACT_SLOTS,
  IMPORT_CONTACT_PERSON_SLOTS,
  contactPersonsToJson,
  parseContactPersonsJson
} from "./clients.helpers";
import { replaceClientAgentAssignments } from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import {
  buildAgentAssignmentPatchesFromImportRow,
  colMapHasAgentSlots,
  type ImportStaffLookup
} from "./clients.import.assign";
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
  trimImportPinfl,
  xlsxCellToString
} from "./clients.import.parse";
import type { ImportFlowContext } from "./clients.import.runtime";
import {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_ERRORS_RETURNED,
  reportImportRowProgress
} from "./clients.import.runtime";
import type { ContactPersonSlot } from "./clients.types";

export async function importClientDataRows(
  tenantId: number,
  rows: unknown[][],
  headerRowIdx: number,
  colIndexByKey: Record<string, number>,
  sheetLabel: string,
  refResolver: ClientImportRefResolver,
  staffLookup: ImportStaffLookup,
  ctx: ImportFlowContext,
  duplicateKeyFields: string[]
): Promise<{
  created: number;
  errors: string[];
  skippedDuplicate: number;
  skippedEmpty: number;
}> {
  const errors: string[] = [];
  let totalRowErrors = 0;
  const pushErr = (msg: string) => {
    totalRowErrors += 1;
    if (errors.length < IMPORT_MAX_ERRORS_RETURNED) errors.push(msg);
  };

  let created = 0;
  let skippedEmpty = 0;
  let skippedDuplicate = 0;
  const hasAgentSlots = colMapHasAgentSlots(colIndexByKey);

  const firstDataRow = headerRowIdx + 1;
  const lastRowIdx = Math.min(rows.length - 1, headerRowIdx + IMPORT_MAX_DATA_ROWS);

  if (firstDataRow > rows.length - 1) {
    return {
      created: 0,
      errors: [
        `Sarlavha ${headerRowIdx + 1}-qatorda («${sheetLabel}»), lekin undan keyin ma’lumot qatori yo‘q.`
      ],
      skippedDuplicate: 0,
      skippedEmpty: 0
    };
  }

  const existingClients = await prisma.client.findMany({
    where: { tenant_id: tenantId, merged_into_client_id: null },
    select: {
      id: true,
      name: true,
      phone_normalized: true,
      client_code: true,
      client_pinfl: true,
      inn: true,
      city: true
    }
  });
  const seenDuplicateKeys = new Set<string>();
  for (const c of existingClients) {
    const k = duplicateKeyFromExistingRow(c, duplicateKeyFields);
    if (k) seenDuplicateKeys.add(k);
  }

  console.info(
    `[clients import/create] tenant=${tenantId} sheet="${sheetLabel}" fileRows=${rows.length} headerRow=${headerRowIdx + 1} estDataRows=${ctx.totalRows} mappedKeys=${Object.keys(colIndexByKey).length} existingInDb=${existingClients.length} duplicateKeys=${duplicateKeyFields.join(",")}`
  );

  for (let r = firstDataRow; r <= lastRowIdx; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) {
      skippedEmpty += 1;
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }

    const resolveStarted = Date.now();
    const nameRaw = readArrayCell(row, colIndexByKey.name);
    if (nameRaw == null) {
      skippedEmpty += 1;
      ctx.resolveMs += Date.now() - resolveStarted;
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }

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
      const fn = readArrayCell(row, colIndexByKey[`contact${p}_firstName`]);
      const ln = readArrayCell(row, colIndexByKey[`contact${p}_lastName`]);
      const ph = readArrayCell(row, colIndexByKey[`contact${p}_phone`]);
      slots[i] = { firstName: fn, lastName: ln, phone: ph };
    }
    ctx.resolveMs += Date.now() - resolveStarted;

    try {
      const nameTrimmed = nameRaw.trim();
      const phoneNormalized = normalizePhoneDigits(phone);
      const cityNorm =
        city != null && String(city).trim()
          ? String(city).trim().toLocaleLowerCase("ru-RU")
          : null;
      const dupKey = buildDuplicateCompositeKey(duplicateKeyFields, {
        client_code,
        client_pinfl,
        inn,
        nameLower: nameTrimmed.toLocaleLowerCase("ru-RU"),
        phoneDigits: phoneNormalized?.replace(/\D/g, "") ?? null,
        cityNorm
      });
      const isDuplicate = dupKey != null && seenDuplicateKeys.has(dupKey);
      if (isDuplicate) {
        skippedDuplicate += 1;
        ctx.processedRows += 1;
        await reportImportRowProgress(ctx, "resolving");
        continue;
      }

      const assignOutcome = hasAgentSlots
        ? buildAgentAssignmentPatchesFromImportRow(row, colIndexByKey, staffLookup, r + 1, ctx.warnings.push)
        : { createPatches: [], updatePatches: [], touched: false };
      const agentPatches = assignOutcome.createPatches;

      const writeStarted = Date.now();
      await prisma.$transaction(async (tx) => {
        const client = await tx.client.create({
          data: {
            tenant_id: tenantId,
            name: nameTrimmed,
            legal_name,
            phone,
            phone_normalized: normalizePhoneDigits(phone),
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
          }
        });
        if (agentPatches.length > 0) {
          await replaceClientAgentAssignments(tx, tenantId, client.id, agentPatches, {
            skipStaffDbValidation: true
          });
        }
      });
      ctx.writeMs += Date.now() - writeStarted;
      created += 1;
      if (dupKey) seenDuplicateKeys.add(dupKey);
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "writing");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "xato";
      const short =
        raw.includes("Unique constraint") || raw.includes("unique constraint")
          ? "bu tenantda telefon yoki boshqa noyob maydon takrorlanmoqda"
          : raw.length > 180
            ? `${raw.slice(0, 180)}…`
            : raw;
      pushErr(`Qator ${r + 1} (Excel): ${short}`);
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "writing");
    }
  }

  const out = [...errors];
  if (created === 0 && errors.length === 0 && skippedEmpty > 0) {
    out.push(
      `Hech kim qo‘shilmadi: Excel ${headerRowIdx + 2}–${rows.length} qatorlarda «name» bo‘sh yoki --- (${skippedEmpty} qator o‘tkazildi).`
    );
  }
  if (skippedDuplicate > 0) {
    out.push(
      `Dublikat klientlar o‘tkazib yuborildi: ${skippedDuplicate} qator (kalit maydonlar: ${duplicateKeyFields.join(", ")}).`
    );
  }
  if (totalRowErrors > IMPORT_MAX_ERRORS_RETURNED) {
    out.push(
      `… va yana ${totalRowErrors - IMPORT_MAX_ERRORS_RETURNED} ta qator xatosi (faqat birinchi ${IMPORT_MAX_ERRORS_RETURNED} matn qaytarildi).`
    );
  }

  for (const line of refResolver.summarizeMisses()) {
    out.push(line);
  }

  return { created, errors: out, skippedDuplicate, skippedEmpty };
}
