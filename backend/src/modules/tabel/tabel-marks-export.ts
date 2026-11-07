import ExcelJS from "exceljs";
import { listTabelMarks } from "./tabel-hub.service";

const ROLE_LABEL: Record<string, string> = {
  in: "Приход",
  estimated_out: "Примерный уход",
  out: "Уход"
};

const SOURCE_LABEL: Record<string, string> = {
  mobile_photo: "Фото + Face ID",
  mobile_video: "Видео + 3-код",
  kiosk: "Киоск бригады",
  terminal: "Терминал Face ID",
  gps: "GPS визит",
  manual: "Вручную"
};

const HEADERS = [
  "Дата",
  "Время",
  "ФИО",
  "Код",
  "Роль",
  "Филиал",
  "Направление",
  "Роль в дне",
  "Источник",
  "Локация",
  "Вне геозоны",
  "Face score",
  "Валидна",
  "Статус проверки",
  "Проблемы",
  "Комментарий"
] as const;

export async function buildTabelMarksExportBuffer(
  tenantId: number,
  filters: {
    from?: string;
    to?: string;
    user_id?: number;
    branch?: string;
    source?: string;
    only_problems?: boolean;
  }
): Promise<{ buffer: Buffer; filename: string }> {
  const items = await listTabelMarks(tenantId, { ...filters, take: 5000 });
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALEC";
  const sheetName = filters.only_problems ? "Проблемные" : "Отметки";
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  ws.addRow([...HEADERS]);
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: "middle", wrapText: true };

  for (const row of items) {
    const occurred = new Date(row.occurred_at);
    const time =
      Number.isNaN(occurred.getTime())
        ? String(row.occurred_at)
        : occurred.toISOString().slice(11, 19);
    ws.addRow([
      row.work_date_ymd,
      time,
      row.user_fio,
      row.user_code ?? "",
      row.user_role,
      row.user_branch ?? "",
      row.direction,
      ROLE_LABEL[row.role_in_day] ?? row.role_in_day,
      SOURCE_LABEL[row.source] ?? row.source,
      row.location_name ?? "",
      row.outside_geofence ? "да" : "нет",
      row.face_score == null ? "" : Number(row.face_score),
      row.is_valid ? "да" : "нет",
      row.review_status,
      (row.problem_reasons ?? []).join("; "),
      row.comment ?? ""
    ]);
  }

  ws.columns = HEADERS.map((h) => ({
    header: h,
    width: Math.min(28, Math.max(10, h.length + 2))
  }));

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const tag = filters.only_problems ? "problems" : "marks";
  const from = filters.from ?? "all";
  const to = filters.to ?? from;
  const filename = `tabel-${tag}_${from}_${to}.xlsx`;
  return { buffer, filename };
}
