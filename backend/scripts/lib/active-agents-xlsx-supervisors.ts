import * as fs from "node:fs";
import {
  SUPERVISOR_HEADER_ALIASES,
  buildHeaderMap,
  cell,
  normPinfl,
  parseSupervisorDisplayName,
  yesRu
} from "./active-agents-xlsx-header";
import { readMatrix, upsertStaffUser, type StaffRowData } from "./active-agents-xlsx-staff";
import {
  linkSupervisorAgentsForRow,
  loadTenantAgentLookup,
  type RunStaffXlsxImportOpts
} from "./active-agents-xlsx-resolve";

export async function runSupervisorsXlsxImport(opts: RunStaffXlsxImportOpts): Promise<void> {
  const { prisma, tenantId, tenantSlug, xlsxPath: abs, dry, defaultPassword, resetPassword } = opts;

  if (defaultPassword.length < 6) throw new Error("Supervayzerlar: parol kamida 6 belgi.");
  if (!fs.existsSync(abs)) throw new Error(`Supervayzerlar Excel yo‘q: ${abs}`);

  const { sheetName, matrix } = readMatrix(abs);
  if (matrix.length < 2) throw new Error("Supervayzerlar Excel: kamida sarlavha + 1 qator.");

  const h = buildHeaderMap(matrix[0] as unknown[], SUPERVISOR_HEADER_ALIASES);
  if (h.fio === undefined) {
    throw new Error("Supervayzerlar Excel: «Ф.И.О» topilmadi.");
  }

  const headerDebug = Object.entries(h)
    .map(([k, i]) => `${k}→${i}`)
    .join(", ");
  console.log(`  Ustun indekslari: ${headerDebug}`);

  console.log(
    `\n════════════  QO‘SHIMCHA: supervayzerlar (Excel)  ════════════\n` +
      `Fayl: ${abs}\nList: ${sheetName}\nTenant: ${tenantSlug}\nDRY_RUN=${dry}\n`
  );

  const hasAgentsCol = h.agentsCol !== undefined;
  if (!hasAgentsCol) {
    console.warn(
      "! «Агент» ustuni (vergul bilan bir nechta FIO/kod) topilmadi — SVR qatorlaridagi agentlar bazada bog‘lanmaydi. Sarlavhani tekshiring."
    );
  }
  const agentLookup = await loadTenantAgentLookup(prisma, tenantId);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    if (!row || row.every((c) => c === "" || c == null)) continue;

    const codeRaw = h.code !== undefined ? cell(row, h.code).toUpperCase().replace(/\s+/g, "") : "";
    const loginCol = h.login !== undefined ? cell(row, h.login).toLowerCase().replace(/\s+/g, "") : "";
    const login = loginCol || codeRaw.toLowerCase();
    if (!login) {
      console.warn(`! qator ${r + 1}: login/kod bo‘sh — o‘tkazildi`);
      skipped++;
      continue;
    }

    const codeForDb = codeRaw || login.toUpperCase();

    const { displayName, first_name, last_name } = parseSupervisorDisplayName(cell(row, h.fio));
    const name = displayName || login;

    const pinfl = normPinfl(h.pinfl !== undefined ? cell(row, h.pinfl) : null);
    const apk_version = h.apk !== undefined ? cell(row, h.apk) || null : null;
    const branch = h.branch !== undefined ? cell(row, h.branch) || null : null;
    const position = h.position !== undefined ? cell(row, h.position) || null : null;

    const appRaw = h.appAccess !== undefined ? cell(row, h.appAccess) : "";
    const app_access = appRaw.trim() === "" ? true : yesRu(appRaw);

    let max_sessions = 2;
    if (h.maxSessions !== undefined) {
      const n = Number(cell(row, h.maxSessions));
      if (Number.isFinite(n) && n >= 1 && n <= 99) max_sessions = Math.floor(n);
    }

    const rowData: StaffRowData = {
      name,
      first_name,
      last_name,
      code: codeForDb || null,
      phone: null,
      pinfl,
      consignment: false,
      apk_version,
      device_name: null,
      last_sync_at: null,
      price_type: null,
      warehouse_id: null,
      disconnectWarehouse: false,
      trade_direction: null,
      territory: null,
      branch,
      position,
      app_access,
      max_sessions,
      role: "supervisor"
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
      console.log(`+ yaratildi supervayzer ${login}`);
    } else if (res.updated) {
      updated++;
      console.log(`~ yangilandi supervayzer ${login}`);
    }

    if (hasAgentsCol) {
      const sup = await prisma.user.findFirst({
        where: { tenant_id: tenantId, login, role: "supervisor" },
        select: { id: true }
      });
      const agentsCell = cell(row, h.agentsCol);
      /** DRY: bazada SVR yo‘q bo‘lsa ham agent tokenlarini tekshirish (updateMany chaqirilmaydi). */
      const canResolveAgents = agentsCell.trim() && (sup != null || dry);
      if (canResolveAgents) {
        const link = await linkSupervisorAgentsForRow({
          prisma,
          tenantId,
          supervisorUserId: sup?.id ?? 0,
          agentsCell,
          lookup: agentLookup,
          dry
        });
        if (link.unmatched.length > 0) {
          const prev = link.unmatched.slice(0, 6).join("; ");
          const more = link.unmatched.length > 6 ? ` … (+${link.unmatched.length - 6})` : "";
          console.warn(`! ${login}: agent topilmadi: ${prev}${more}`);
        }
        if (dry && link.resolvedCount > 0) {
          console.log(`  [dry] SVR→agent: ${link.resolvedCount} ta mos keldi (bazaga yozilmadi)`);
        } else if (!dry && link.applied > 0) {
          console.log(`  ↔ SVR→agent: ${link.applied} ta supervisor_user_id yangilandi`);
        }
      }
    }
  }

  console.log(`── Supervayzerlar Excel: yangi=${created}, yangilangan=${updated}, o‘tkazilgan=${skipped}\n`);
}
