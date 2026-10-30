/**
 * Excel «Агент N день» ustunlarini parser orqali Пн..Вс qisqartmasiga aylantiradi.
 * Shanba: 6 yoki Сб (1..7); 0..6 rejimida katakda 0 bo‘lsa 5→Сб.
 */
import * as XLSX from "xlsx";
import {
  formatVisitWeekdaysRuAbbrev,
  parseVisitWeekdaysFromCell
} from "../src/modules/clients/clients.visit-weekdays";

const src = "tmp/clients_update_from_excel.xlsx";
const dst = "tmp/clients_update_from_excel_weekdays_fixed.xlsx";

const wb = XLSX.readFile(src);
const sheetName = wb.SheetNames[0]!;
const sheet = wb.Sheets[sheetName]!;
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
  defval: "",
  raw: false
});

const dayKeys = Object.keys(rows[0] ?? {}).filter((k) => /день/i.test(k));
let changed = 0;
let saturdayRows = 0;

for (const row of rows) {
  for (const k of dayKeys) {
    const raw = String(row[k] ?? "").trim();
    if (!raw) continue;
    const { days, unknownTokens } = parseVisitWeekdaysFromCell(raw);
    if (unknownTokens.length && days.length === 0) {
      console.warn("unparsed", raw, unknownTokens);
      continue;
    }
    const next = formatVisitWeekdaysRuAbbrev(days);
    if (next !== raw) changed += 1;
    row[k] = next;
    if (days.includes(6)) saturdayRows += 1;
  }
}

const out = XLSX.utils.json_to_sheet(rows);
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, out, sheetName);
XLSX.writeFile(outWb, dst);

console.log({
  rows: rows.length,
  dayKeys,
  cellsRewritten: changed,
  rowsWithSaturdayAfterFix: saturdayRows,
  out: dst
});
console.log("Shanba: «Сб» yoki «6» (faqat 1…7). «0» qabul qilinmaydi.");
