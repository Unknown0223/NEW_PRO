import ExcelJS from "exceljs";
import type { StoredClient } from "./types.js";

const CONTACT_SLOTS = 10;
const DAYS_RU = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function lalakuNewClientTemplateHeaders(): string[] {
  const agentCols: string[] = [];
  for (let i = 1; i <= CONTACT_SLOTS; i++) {
    agentCols.push(`Агент ${i}`, `Агент ${i} день`, `Экспедитор ${i}`);
  }
  return [
    "ИД",
    "Наименование",
    "Юридическое название",
    "Адрес",
    "Телефон",
    "Контактное лицо",
    "Ориентир",
    "ИНН",
    "ПИНФЛ",
    "Торговый канал (код)",
    "Категория клиента (код)",
    "Тип клиента (код)",
    "Формат (код)",
    "Город (код)",
    "Широта",
    "Долгота",
    ...agentCols
  ];
}

function daysRu(days: number[]): string {
  return days
    .filter((d) => d >= 1 && d <= 7)
    .map((d) => DAYS_RU[d])
    .join(", ");
}

export async function buildIntakeExcelBuffer(rows: StoredClient[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KPI", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = lalakuNewClientTemplateHeaders();
  ws.addRow(headers);
  const r1 = ws.getRow(1);
  r1.font = { bold: true };
  r1.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F4F8" } };
  });

  for (const row of rows) {
    const p = row.payload;
    const line: Array<string | number> = [
      "",
      p.name ?? "",
      p.legal_name ?? "",
      p.address ?? "",
      p.phone ?? "",
      p.responsible_person ?? "",
      p.landmark ?? "",
      p.inn ?? "",
      p.pinfl ?? "",
      p.sales_channel ?? "",
      p.category ?? "",
      p.client_type ?? "",
      p.client_format ?? "",
      p.city ?? "",
      p.lat ?? "",
      p.lon ?? ""
    ];
    line.push(row.agent_smart_code || row.agent_code || "");
    line.push(daysRu(p.visit_weekdays ?? []));
    line.push("---");
    for (let i = 2; i <= CONTACT_SLOTS; i++) {
      line.push("---", "---", "---");
    }
    ws.addRow(line);
  }
  ws.columns = headers.map(() => ({ width: 16 }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
