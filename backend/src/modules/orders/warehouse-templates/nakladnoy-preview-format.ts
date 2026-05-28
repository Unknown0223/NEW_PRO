import type ExcelJS from "exceljs";

/** Preview/Excel ko‘rinishida raqamlarni o‘qish oson format (3 xonali guruh). */
export function formatPreviewNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : n;
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(n - Math.round(n)) < 1e-6 ? 0 : 2
  }).format(rounded);
}

function rawToDisplayString(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "";
    return formatPreviewNumber(raw);
  }
  if (typeof raw === "boolean") return raw ? "TRUE" : "FALSE";
  if (raw instanceof Date) return raw.toLocaleDateString("ru-RU");
  const s = String(raw).trim();
  if (s === "NaN" || s === "Infinity" || s === "-Infinity") return "";
  if (/^#(DIV\/0|REF|VALUE|NUM|NAME)!?$/i.test(s)) return "";
  const asNum = Number(s.replace(/\s/g, "").replace(/,/g, "."));
  if (s !== "" && Number.isFinite(asNum) && /^-?[\d\s.,]+$/.test(s)) {
    return formatPreviewNumber(asNum);
  }
  return s;
}

/** ExcelJS katak qiymatini virtual preview uchun matn. */
export function previewCellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";

  if (typeof v === "object" && "richText" in v && Array.isArray((v as ExcelJS.CellRichTextValue).richText)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((x) => x.text ?? "").join("");
  }

  if (typeof v === "object" && ("formula" in v || "sharedFormula" in v)) {
    const fv = v as ExcelJS.CellFormulaValue;
    const result = fv.result;
    if (result != null) return rawToDisplayString(result);
    return "";
  }

  if (typeof v === "number") return formatPreviewNumber(v);
  if (v instanceof Date) return v.toLocaleDateString("ru-RU");

  return rawToDisplayString(v);
}
