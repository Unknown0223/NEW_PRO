import * as XLSX from "xlsx";
import { parseVisitWeekdaysFromCell } from "../src/modules/clients/clients.visit-weekdays";

const wb = XLSX.readFile("tmp/clients_update_from_excel.xlsx");
const sheet = wb.Sheets[wb.SheetNames[0]!]!;
const rowsRaw = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
  defval: null,
  raw: true,
  header: 1
});
const header = (rowsRaw[0] ?? []).map((h) => String(h ?? ""));
const dayIdx = header.map((h, i) => (/день/i.test(h) ? i : -1)).filter((i) => i >= 0);
console.log(
  "dayIdx",
  dayIdx.map((i) => `${i}:${header[i]}`)
);

const types = new Map<string, number>();
const with6: Array<{ row: number; vals: unknown[] }> = [];
for (let r = 1; r < rowsRaw.length; r++) {
  const row = rowsRaw[r] ?? [];
  for (const i of dayIdx) {
    const v = row[i];
    if (v == null || v === "") continue;
    const t = `${typeof v}:${JSON.stringify(v)}`;
    types.set(t, (types.get(t) || 0) + 1);
    const s = String(v);
    if (/(^|[,.\s])6([,.\s]|$)/.test(s) || /сб|shanba/i.test(s)) {
      with6.push({ row: r + 1, vals: dayIdx.map((di) => row[di]) });
    }
  }
}
console.log("raw types", [...types.entries()].sort((a, b) => b[1] - a[1]));
console.log("rows mentioning 6/Сб", with6.length, with6.slice(0, 10));

console.log("\nparse matrix 0..7:");
for (let n = 0; n <= 7; n++) {
  console.log(n, parseVisitWeekdaysFromCell(String(n)));
}
