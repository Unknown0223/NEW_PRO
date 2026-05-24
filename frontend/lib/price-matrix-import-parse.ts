import { parsePriceDraft, sanitizePriceInput } from "@/lib/price-matrix-draft";

export type PriceMatrixRowRef = {
  product_id: number;
  name: string;
  sku: string;
};

export type PriceImportRowStatus = "ok" | "warning" | "error";

export type PriceMatrixImportPreviewRow = {
  rowNum: number;
  sku: string;
  name: string;
  product_id: number | null;
  priceDisplay: string;
  status: PriceImportRowStatus;
  message: string;
};

function priceImportHeaderToKey(h: string): string | null {
  const n = h.trim().toLowerCase().replace(/\s+/g, "_");
  if (n === "sku" || n === "kod" || n.includes("артикул") || n === "artikul") return "sku";
  if (n === "price" || n === "narxi" || n.includes("narx") || n === "summa" || n.includes("сумма"))
    return "price";
  return null;
}

function cellText(cell: unknown): string {
  if (cell == null) return "";
  if (typeof cell === "number" && Number.isFinite(cell)) return String(cell);
  return String(cell).trim();
}

function normalizeSku(s: string): string {
  return s.trim();
}

export function buildSkuIndex(rows: PriceMatrixRowRef[]): Map<string, PriceMatrixRowRef> {
  const map = new Map<string, PriceMatrixRowRef>();
  for (const r of rows) {
    const key = normalizeSku(r.sku);
    if (key) map.set(key, r);
    map.set(key.toLowerCase(), r);
  }
  return map;
}

export function parsePriceMatrixXlsxRows(
  matrix: unknown[][],
  skuIndex: Map<string, PriceMatrixRowRef>
): PriceMatrixImportPreviewRow[] {
  if (matrix.length === 0) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const row = matrix[i] ?? [];
    for (const cell of row) {
      const key = priceImportHeaderToKey(cellText(cell));
      if (key === "sku" || key === "price") {
        headerRowIdx = i;
        break;
      }
    }
  }

  const headerRow = matrix[headerRowIdx] ?? [];
  const colIndexByKey: Record<string, number> = {};
  headerRow.forEach((cell, col) => {
    const key = priceImportHeaderToKey(cellText(cell));
    if (key) colIndexByKey[key] = col;
  });

  if (colIndexByKey.sku == null) {
    return [
      {
        rowNum: headerRowIdx + 1,
        sku: "",
        name: "",
        product_id: null,
        priceDisplay: "",
        status: "error",
        message: "Birinchi qatorda SKU (kod) ustuni kerak"
      }
    ];
  }

  const out: PriceMatrixImportPreviewRow[] = [];
  const dataStart = headerRowIdx + 1;

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const excelRow = r + 1;
    const sku = normalizeSku(
      colIndexByKey.sku != null ? cellText(row[colIndexByKey.sku]) : ""
    );
    const priceRaw =
      colIndexByKey.price != null ? cellText(row[colIndexByKey.price]) : "";
    const priceDisplay = sanitizePriceInput(priceRaw);

    if (!sku && !priceRaw) continue;
    if (sku.startsWith("#")) continue;

    if (!sku) {
      out.push({
        rowNum: excelRow,
        sku: "",
        name: "",
        product_id: null,
        priceDisplay,
        status: "error",
        message: "SKU bo‘sh"
      });
      continue;
    }

    const ref = skuIndex.get(sku) ?? skuIndex.get(sku.toLowerCase());
    if (!ref) {
      out.push({
        rowNum: excelRow,
        sku,
        name: "",
        product_id: null,
        priceDisplay,
        status: "error",
        message: "SKU ushbu kategoriyada topilmadi"
      });
      continue;
    }

    if (priceDisplay.trim() === "") {
      out.push({
        rowNum: excelRow,
        sku,
        name: ref.name,
        product_id: ref.product_id,
        priceDisplay: "",
        status: "warning",
        message: "Narx bo‘sh — o‘tkazib yuboriladi"
      });
      continue;
    }

    const parsed = parsePriceDraft(priceDisplay);
    if (!parsed.ok) {
      out.push({
        rowNum: excelRow,
        sku,
        name: ref.name,
        product_id: ref.product_id,
        priceDisplay,
        status: "error",
        message: parsed.reason === "too_large" ? "Narx juda katta" : "Narx noto‘g‘ri"
      });
      continue;
    }

    out.push({
      rowNum: excelRow,
      sku,
      name: ref.name,
      product_id: ref.product_id,
      priceDisplay: String(parsed.value),
      status: "ok",
      message: ""
    });
  }

  return out;
}

export function importRowsToPatchItems(
  rows: PriceMatrixImportPreviewRow[]
): Array<{ product_id: number; price: number }> {
  const items: Array<{ product_id: number; price: number }> = [];
  for (const row of rows) {
    if (row.status !== "ok" || row.product_id == null) continue;
    const parsed = parsePriceDraft(row.priceDisplay);
    if (parsed.ok) items.push({ product_id: row.product_id, price: parsed.value });
  }
  return items;
}

export async function readXlsxMatrix(file: File): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName]!;
  return XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false
  }) as unknown[][];
}
