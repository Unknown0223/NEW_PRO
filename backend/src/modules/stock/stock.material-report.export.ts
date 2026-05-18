import XLSX from "xlsx";
import { fixed } from "./stock.shared";
import type { MaterialReportExportOpts } from "./stock.material-report.types";
import { listMaterialReport } from "./stock.material-report.list";

export async function buildMaterialReportExportBuffer(
  tenantId: number,
  opts: MaterialReportExportOpts
): Promise<Buffer> {
  const res = await listMaterialReport(tenantId, { ...opts, page: 1, limit: 25_000 });
  const mode = opts.mode ?? "detailed";
  const sheet =
    mode === "summary"
      ? Object.values(
          res.data.reduce(
            (acc, r) => {
              const key = (r.category_name ?? "").trim() || "Без категории";
              if (!acc[key]) {
                acc[key] = {
                  Категория: key,
                  "Остаток на начало периода": 0,
                  Поступление: 0,
                  "Корректировка+": 0,
                  "Возврат с полки": 0,
                  "Инвентаризация+": 0,
                  "Перемещения+": 0,
                  "Частичный возврат": 0,
                  Продажа: 0,
                  "Возврат поставщика": 0,
                  "Корректировка-": 0,
                  Бонус: 0,
                  Списание: 0,
                  "Перемещения-": 0,
                  "Инвентаризация-": 0,
                  "Отмена поступления": 0,
                  "Остаток на конец периода": 0,
                  Объем: 0
                };
              }
              acc[key]["Остаток на начало периода"] += Number(r.beginning_stock) || 0;
              acc[key].Поступление += Number(r.incoming_receipt) || 0;
              acc[key]["Корректировка+"] += Number(r.correction_plus) || 0;
              acc[key]["Возврат с полки"] += Number(r.return_from_shelf) || 0;
              acc[key]["Инвентаризация+"] += Number(r.inventory_plus) || 0;
              acc[key]["Перемещения+"] += Number(r.transfer_plus) || 0;
              acc[key]["Частичный возврат"] += Number(r.partial_return) || 0;
              acc[key].Продажа += Number(r.sale_out) || 0;
              acc[key]["Возврат поставщика"] += Number(r.supplier_return) || 0;
              acc[key]["Корректировка-"] += Number(r.correction_minus) || 0;
              acc[key].Бонус += Number(r.bonus_out) || 0;
              acc[key].Списание += Number(r.writeoff_out) || 0;
              acc[key]["Перемещения-"] += Number(r.transfer_minus) || 0;
              acc[key]["Инвентаризация-"] += Number(r.inventory_minus) || 0;
              acc[key]["Отмена поступления"] += Number(r.canceled_receipt) || 0;
              acc[key]["Остаток на конец периода"] += Number(r.ending_stock) || 0;
              acc[key].Объем += Number(r.volume_m3) || 0;
              return acc;
            },
            {} as Record<
              string,
              {
                Категория: string;
                "Остаток на начало периода": number;
                Поступление: number;
                "Корректировка+": number;
                "Возврат с полки": number;
                "Инвентаризация+": number;
                "Перемещения+": number;
                "Частичный возврат": number;
                Продажа: number;
                "Возврат поставщика": number;
                "Корректировка-": number;
                Бонус: number;
                Списание: number;
                "Перемещения-": number;
                "Инвентаризация-": number;
                "Отмена поступления": number;
                "Остаток на конец периода": number;
                Объем: number;
              }
            >
          )
        ).map((r) => ({
          ...r,
          "Остаток на начало периода": fixed(r["Остаток на начало периода"], 3),
          Поступление: fixed(r.Поступление, 3),
          "Корректировка+": fixed(r["Корректировка+"], 3),
          "Возврат с полки": fixed(r["Возврат с полки"], 3),
          "Инвентаризация+": fixed(r["Инвентаризация+"], 3),
          "Перемещения+": fixed(r["Перемещения+"], 3),
          "Частичный возврат": fixed(r["Частичный возврат"], 3),
          Продажа: fixed(r.Продажа, 3),
          "Возврат поставщика": fixed(r["Возврат поставщика"], 3),
          "Корректировка-": fixed(r["Корректировка-"], 3),
          Бонус: fixed(r.Бонус, 3),
          Списание: fixed(r.Списание, 3),
          "Перемещения-": fixed(r["Перемещения-"], 3),
          "Инвентаризация-": fixed(r["Инвентаризация-"], 3),
          "Отмена поступления": fixed(r["Отмена поступления"], 3),
          "Остаток на конец периода": fixed(r["Остаток на конец периода"], 3),
          Объем: fixed(r.Объем, 6)
        }))
      : res.data.map((r) => ({
          Продукт: r.product_name,
          Категория: r.category_name ?? "",
          "Остаток на начало периода": r.beginning_stock,
          Поступление: r.incoming_receipt,
          "Корректировка+": r.correction_plus,
          "Возврат с полки": r.return_from_shelf,
          "Инвентаризация+": r.inventory_plus,
          "Перемещения+": r.transfer_plus,
          "Частичный возврат": r.partial_return,
          Продажа: r.sale_out,
          "Возврат поставщика": r.supplier_return,
          "Корректировка-": r.correction_minus,
          Бонус: r.bonus_out,
          Списание: r.writeoff_out,
          "Перемещения-": r.transfer_minus,
          "Инвентаризация-": r.inventory_minus,
          "Отмена поступления": r.canceled_receipt,
          "Остаток на конец периода": r.ending_stock,
          Объем: r.volume_m3
        }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheet.length ? sheet : [{ Продукт: "" }]);
  XLSX.utils.book_append_sheet(wb, ws, mode === "summary" ? "Мат.отчёт (общий)" : "Мат.отчёт (детальный)");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
