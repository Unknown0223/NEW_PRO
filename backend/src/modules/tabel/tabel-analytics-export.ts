import ExcelJS from "exceljs";
import { getTabelAnalytics } from "./tabel-analytics.service";

const ROLE_LABELS: Record<string, string> = {
  admin: "Админ",
  agent: "Агент",
  supervisor: "Супервайзер",
  collector: "Инкассатор",
  expeditor: "Экспедитор",
  skladchik: "Складчик",
  auditor: "Аудитор",
  operator: "Оператор",
  director: "Директор",
  sales_director: "Директор по продажам",
  manager: "Менеджер",
  regional_manager: "Региональный менеджер",
  accountant: "Бухгалтер",
  warehouse_manager: "Менеджер склада",
  cashier: "Кассир"
};

function roleLabel(role: string): string {
  const key = role.trim().toLowerCase();
  return ROLE_LABELS[key] ?? role;
}

const EMP_HEADERS = [
  "ФИО",
  "Код",
  "Роль",
  "Филиал",
  "Направление",
  "Отработано",
  "Прогул",
  "Отпуск",
  "Больничный",
  "Командировка",
  "Опоздания (дн)",
  "Опоздания (мин)",
  "Ранний уход (мин)",
  "Сверхурочные (ч)"
] as const;

const GROUP_HEADERS = [
  "Группа",
  "Сотрудников",
  "Отработано",
  "Прогул",
  "Отпуск",
  "Больничный",
  "Командировка",
  "Опоздания (дн)",
  "Опоздания (мин)",
  "Сверхурочные (ч)"
] as const;

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
}

export async function buildTabelAnalyticsExportBuffer(
  tenantId: number,
  month: string,
  branch?: string
): Promise<{ buffer: Buffer; filename: string }> {
  const data = await getTabelAnalytics(tenantId, month, branch);
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALEC";

  const empSheet = wb.addWorksheet("Сотрудники", { views: [{ state: "frozen", ySplit: 1 }] });
  empSheet.addRow([...EMP_HEADERS]);
  styleHeader(empSheet.getRow(1));
  for (const e of data.employees) {
    empSheet.addRow([
      e.fio,
      e.code ?? "",
      roleLabel(e.role),
      e.branch ?? "",
      e.direction ?? "",
      e.worked_days,
      e.absent_days,
      e.vacation_days,
      e.sick_days,
      e.trip_days,
      e.late_days,
      e.late_minutes,
      e.early_leave_minutes,
      e.overtime_hours
    ]);
  }
  empSheet.columns = EMP_HEADERS.map((h) => ({ width: Math.min(22, Math.max(10, h.length + 2)) }));

  const branchSheet = wb.addWorksheet("По филиалам", { views: [{ state: "frozen", ySplit: 1 }] });
  branchSheet.addRow([...GROUP_HEADERS]);
  styleHeader(branchSheet.getRow(1));
  for (const g of data.by_branch) {
    branchSheet.addRow([
      g.branch,
      g.employees,
      g.worked_days,
      g.absent_days,
      g.vacation_days,
      g.sick_days,
      g.trip_days,
      g.late_days,
      g.late_minutes,
      g.overtime_hours
    ]);
  }
  branchSheet.columns = GROUP_HEADERS.map((h) => ({ width: Math.min(22, Math.max(10, h.length + 2)) }));

  const roleSheet = wb.addWorksheet("По ролям", { views: [{ state: "frozen", ySplit: 1 }] });
  roleSheet.addRow([...GROUP_HEADERS]);
  styleHeader(roleSheet.getRow(1));
  for (const g of data.by_role) {
    roleSheet.addRow([
      roleLabel(g.role),
      g.employees,
      g.worked_days,
      g.absent_days,
      g.vacation_days,
      g.sick_days,
      g.trip_days,
      g.late_days,
      g.late_minutes,
      g.overtime_hours
    ]);
  }
  roleSheet.columns = GROUP_HEADERS.map((h) => ({ width: Math.min(22, Math.max(10, h.length + 2)) }));

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const filename = `tabel-analytics_${month}.xlsx`;
  return { buffer, filename };
}
