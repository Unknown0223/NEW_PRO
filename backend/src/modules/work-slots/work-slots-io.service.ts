import * as XLSX from "xlsx";
import { prisma } from "../../config/database";
import { isWorkSlotType } from "./work-slots.constants";

export type WorkSlotImportRow = {
  slot_code: string;
  label?: string | null;
  branch_code?: string | null;
  slot_type?: string;
  is_active?: boolean;
  sort_order?: number;
  assign_login?: string | null;
};

export async function buildWorkSlotsExportBuffer(tenantId: number): Promise<Buffer> {
  const rows = await prisma.workSlot.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ sort_order: "asc" }, { slot_code: "asc" }],
    include: {
      direction: { select: { name: true } },
      user_links: {
        where: { ended_at: null },
        take: 1,
        include: { user: { select: { login: true, name: true } } }
      }
    }
  });

  const sheet = rows.map((r) => {
    const link = r.user_links[0];
    return {
      slot_code: r.slot_code,
      label: r.label ?? "",
      branch_code: r.branch_code ?? "",
      direction: r.direction?.name ?? "",
      slot_type: r.slot_type,
      is_active: r.is_active ? "yes" : "no",
      sort_order: r.sort_order,
      active_user_login: link?.user.login ?? "",
      active_user_name: link?.user.name ?? ""
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    sheet.length ? sheet : [{ slot_code: "", label: "", branch_code: "", slot_type: "agent" }]
  );
  XLSX.utils.book_append_sheet(wb, ws, "work_slots");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function parseBoolCell(v: unknown): boolean {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (s === "yes" || s === "1" || s === "true" || s === "да" || s === "ha") return true;
  if (s === "no" || s === "0" || s === "false" || s === "нет" || s === "yoq") return false;
  return true;
}

export async function importWorkSlotsFromBuffer(
  tenantId: number,
  buffer: Buffer,
  actorUserId: number | null
): Promise<{ created: number; updated: number; assigned: number; errors: string[] }> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("EMPTY_FILE");
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, { defval: "" });
  if (raw.length === 0) throw new Error("EMPTY_FILE");
  if (raw.length > 2000) throw new Error("TOO_MANY_ROWS");

  let created = 0;
  let updated = 0;
  let assigned = 0;
  const errors: string[] = [];

  const { assignUserToSlot } = await import("./work-slots.assign");

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]!;
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        if (row[k] != null && String(row[k]).trim() !== "") return row[k];
      }
      return "";
    };
    const code = String(
      pick("slot_code", "Slot_code", "slot code", "Код слота", "код слота")
    )
      .trim()
      .toUpperCase();
    if (!code) continue;

    let slotType = String(pick("slot_type", "Slot_type", "Тип слота", "тип слота") || "agent")
      .trim()
      .toLowerCase();
    const slotTypeMap: Record<string, string> = {
      агент: "agent",
      agent: "agent",
      экспедитор: "expeditor",
      expeditor: "expeditor",
      сборщик: "collector",
      collector: "collector",
      складчик: "skladchik",
      skladchik: "skladchik",
      супервайзер: "supervisor",
      supervisor: "supervisor",
      аудитор: "auditor",
      auditor: "auditor"
    };
    slotType = slotTypeMap[slotType] ?? slotType;
    if (!isWorkSlotType(slotType)) {
      errors.push(`Строка ${i + 2}: неверный тип слота «${slotType}»`);
      continue;
    }

    const label = String(pick("label", "Название", "название")).trim() || null;
    const branch = String(pick("branch_code", "branch", "Код филиала", "код филиала")).trim() || null;
    const isActive = parseBoolCell(pick("is_active", "Активен (да/нет)", "Активен"));
    const sortOrder = Number.parseInt(String(pick("sort_order", "Сортировка") || "0"), 10);
    const assignLogin = String(
      pick("assign_login", "active_user_login", "Логин агента", "логин агента")
    )
      .trim()
      .toLowerCase();

    try {
      const existing = await prisma.workSlot.findFirst({
        where: { tenant_id: tenantId, slot_code: code },
        select: { id: true }
      });

      let slotId: number;
      if (existing) {
        await prisma.workSlot.update({
          where: { id: existing.id },
          data: {
            label,
            branch_code: branch,
            slot_type: slotType,
            is_active: isActive,
            sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
          }
        });
        slotId = existing.id;
        updated += 1;
      } else {
        const createdRow = await prisma.workSlot.create({
          data: {
            tenant_id: tenantId,
            slot_code: code,
            label,
            branch_code: branch,
            slot_type: slotType,
            is_active: isActive,
            sort_order: Number.isFinite(sortOrder) ? sortOrder : 0
          }
        });
        slotId = createdRow.id;
        created += 1;
      }

      if (assignLogin) {
        const user = await prisma.user.findFirst({
          where: { tenant_id: tenantId, login: assignLogin, is_active: true },
          select: { id: true }
        });
        if (!user) {
          errors.push(`Строка ${i + 2}: логин не найден «${assignLogin}»`);
        } else {
          await assignUserToSlot(tenantId, slotId, user.id, actorUserId, "Excel import");
          assigned += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ошибка";
      errors.push(`Строка ${i + 2}: ${msg}`);
    }
  }

  return { created, updated, assigned, errors };
}
