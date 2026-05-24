import * as fs from "node:fs";
import {
  AGENT_HEADER_ALIASES,
  buildHeaderMap,
  cell,
  normPinfl,
  parseDateCell,
  parseNameFromFio,
  pickPriceType,
  resolveFirstWarehouseId,
  yesRu
} from "./active-agents-xlsx-header";
import { readMatrix, upsertStaffUser, type StaffRowData } from "./active-agents-xlsx-staff";
import type { RunStaffXlsxImportOpts } from "./active-agents-xlsx-resolve";

export async function runActiveAgentsXlsxImport(opts: RunStaffXlsxImportOpts): Promise<void> {
  const { prisma, tenantId, tenantSlug, xlsxPath: abs, dry, defaultPassword, resetPassword } = opts;

  if (defaultPassword.length < 6) {
    throw new Error("Agentlar: parol kamida 6 belgi.");
  }
  if (!fs.existsSync(abs)) throw new Error(`Agentlar Excel yo‘q: ${abs}`);

  const { sheetName, matrix } = readMatrix(abs);
  if (matrix.length < 2) throw new Error("Agentlar Excel: kamida sarlavha + 1 qator.");

  const h = buildHeaderMap(matrix[0] as unknown[], AGENT_HEADER_ALIASES);
  if (h.code === undefined || h.fio === undefined) {
    throw new Error("Agentlar Excel: «Код» va «Ф.И.О» topilmadi.");
  }

  console.log(
    `\n════════════  QO‘SHIMCHA: faol agentlar (Excel)  ════════════\n` +
      `Fayl: ${abs}\nList: ${sheetName}\nTenant: ${tenantSlug} (id=${tenantId})\nDRY_RUN=${dry}\n`
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    if (!row || row.every((c) => c === "" || c == null)) continue;

    const codeRaw = cell(row, h.code).toUpperCase().replace(/\s+/g, "");
    if (!codeRaw) {
      console.warn(`! qator ${r + 1}: kod bo‘sh — o‘tkazildi`);
      skipped++;
      continue;
    }

    const login = codeRaw.toLowerCase();
    const { displayName, first_name, last_name } = parseNameFromFio(cell(row, h.fio));
    const name = displayName || codeRaw;

    const pinfl = normPinfl(h.pinfl !== undefined ? cell(row, h.pinfl) : null);
    const consignmentFinal = yesRu(h.consignment !== undefined ? cell(row, h.consignment) : "");

    const apk_version = h.apk !== undefined ? cell(row, h.apk) || null : null;
    const device_name = h.device !== undefined ? cell(row, h.device) || null : null;
    const last_sync_at = parseDateCell(h.lastSync !== undefined ? row[h.lastSync] : undefined);

    const phone = h.phone !== undefined ? cell(row, h.phone) || null : null;
    const price_type = h.priceType !== undefined ? pickPriceType(cell(row, h.priceType)) : null;

    const warehouseRaw = h.warehouse !== undefined ? cell(row, h.warehouse) : "";
    const trade_direction = h.tradeDirection !== undefined ? cell(row, h.tradeDirection) || null : null;
    const branch = h.branch !== undefined ? cell(row, h.branch) || null : null;
    const position = h.position !== undefined ? cell(row, h.position) || null : null;

    const appRaw = h.appAccess !== undefined ? cell(row, h.appAccess) : "";
    const app_access = appRaw.trim() === "" ? true : yesRu(appRaw);

    let max_sessions = 2;
    if (h.maxSessions !== undefined) {
      const n = Number(cell(row, h.maxSessions));
      if (Number.isFinite(n) && n >= 1 && n <= 99) max_sessions = Math.floor(n);
    }

    const { id: warehouse_id, tried: whTried } = await resolveFirstWarehouseId(
      prisma,
      tenantId,
      warehouseRaw
    );
    if (warehouseRaw.trim() && warehouse_id == null) {
      console.warn(`! ${login}: ombor topilmadi (sinangan: ${whTried[0] ?? "—"})`);
    }

    const rowData: StaffRowData = {
      name,
      first_name,
      last_name,
      code: codeRaw,
      phone,
      pinfl,
      consignment: consignmentFinal,
      apk_version,
      device_name,
      last_sync_at,
      price_type,
      warehouse_id,
      disconnectWarehouse: warehouseRaw.trim() !== "" && warehouse_id == null,
      trade_direction,
      territory: null,
      branch,
      position,
      app_access,
      max_sessions,
      role: "agent"
    };

    const res = await upsertStaffUser(
      prisma,
      tenantId,
      login,
      dry,
      resetPassword,
      defaultPassword,
      rowData
    );
    if (res.dryLine) console.log(res.dryLine);
    else if (res.created) {
      created++;
      console.log(`+ yaratildi ${login} (${codeRaw})`);
    } else if (res.updated) {
      updated++;
      console.log(`~ yangilandi ${login} (${codeRaw})`);
    }
  }

  console.log(`── Agentlar Excel: yangi=${created}, yangilangan=${updated}, o‘tkazilgan=${skipped}\n`);
}
