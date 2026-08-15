import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { GPS_DELIVERY_EXPORT_CAP } from "./gps-delivery-routes.types";
import { parseGpsDeliveryRoutesQuery } from "./gps-delivery-routes.parse";
import { getGpsDeliveryRoutesReport } from "./gps-delivery-routes.report";

/** Shablon ustunlari: Отчет по маршрутам доставщиков.xlsx */
const HEADERS = [
  "Имя экспедитора",
  "Код экспедитора",
  "Фактическое время",
  "Расчётное время",
  "Расчётная длина маршрута",
  "Ожидаемая длина маршрута",
  "Ожидаемое время",
  "Количество визитов",
  "Был в точке",
  "Вне точки"
] as const;

/** Excel duration (kunning ulushi) — format `[h]:mm:ss`, SUM ishlaydi. */
function excelDurationFromSec(sec: number): number {
  const s = Math.max(0, Number(sec) || 0);
  return s / 86400;
}

/** Masofa km da (3 xona) — Excelda yig‘ish uchun son. */
function excelKmFromMeters(meters: number): number {
  const m = Math.max(0, Number(meters) || 0);
  return Math.round((m / 1000) * 1000) / 1000;
}

function setNum(sheet: XLSX.WorkSheet, addr: string, value: number, numFmt: string) {
  sheet[addr] = { t: "n", v: value, z: numFmt };
}

export async function exportGpsDeliveryRoutesXlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const vf = { ...parseGpsDeliveryRoutesQuery(q), page: 1, limit: GPS_DELIVERY_EXPORT_CAP };
  const payload = await getGpsDeliveryRoutesReport(tenantId, vf, actor);
  const truncated = payload.total > GPS_DELIVERY_EXPORT_CAP;
  const rows = truncated ? payload.rows.slice(0, GPS_DELIVERY_EXPORT_CAP) : payload.rows;

  const sheet = XLSX.utils.aoa_to_sheet([[...HEADERS]]);

  rows.forEach((r, i) => {
    const row = i + 2; // 1-based, header = 1
    sheet[`A${row}`] = { t: "s", v: r.expeditor_name };
    sheet[`B${row}`] = { t: "s", v: r.expeditor_code };
    setNum(sheet, `C${row}`, excelDurationFromSec(r.actual_time_sec), "[h]:mm:ss");
    setNum(sheet, `D${row}`, excelDurationFromSec(r.calculated_time_sec), "[h]:mm:ss");
    setNum(sheet, `E${row}`, excelKmFromMeters(r.calculated_route_m), "0.000");
    setNum(sheet, `F${row}`, excelKmFromMeters(r.expected_route_m), "0.000");
    setNum(sheet, `G${row}`, excelDurationFromSec(r.expected_time_sec), "[h]:mm:ss");
    setNum(sheet, `H${row}`, r.visits_count, "0");
    setNum(sheet, `I${row}`, r.at_point, "0");
    setNum(sheet, `J${row}`, r.outside_point, "0");
  });

  if (rows.length > 0) {
    sheet["!ref"] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rows.length, c: HEADERS.length - 1 }
    });
  }

  // Ustun kengligi — vaqt / km o‘qish uchun
  sheet["!cols"] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Sheet1");
  const buffer = Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellStyles: true })
  );
  return { buffer, total: payload.total, truncated };
}
