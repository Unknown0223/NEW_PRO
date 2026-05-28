import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";
import { EXPEDITOR_LOADING_DEFS } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-ids";

const ASSET_DIR = join(__dirname, "../assets/nakladnoy/loading");

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  return String(v).trim();
}

async function main() {
  for (const d of EXPEDITOR_LOADING_DEFS) {
    if (d.id === "ex-5.2.0") continue;
    try {
      const p = join(ASSET_DIR, d.assetFile);
      const fixed = await preprocessExpeditorTemplateBuffer(readFileSync(p));
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(fixed as never);
      const sheets = wb.worksheets.map((ws) => {
        let hit = "";
        ws.eachRow({ includeEmpty: false }, (row, ri) => {
          if (hit) return;
          row.eachCell({ includeEmpty: false }, (cell) => {
            if (hit) return;
            const t = cellStr(cell.value).toLowerCase();
            if (t.includes("продукт") || t.includes("количество") || t.includes("кол-во")) {
              hit = `r${ri}: ${t.slice(0, 40)}`;
            }
          });
        });
        return { name: ws.name, rows: ws.rowCount, cols: ws.columnCount, hit };
      });
      console.log(d.id, JSON.stringify(sheets));
    } catch (e) {
      console.log(d.id, "ERR", e instanceof Error ? e.message : e);
    }
  }
}

main();
