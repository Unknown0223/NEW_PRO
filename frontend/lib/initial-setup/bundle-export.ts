import { api } from "@/lib/api";
import * as XLSX from "xlsx";
import {
  BUNDLE_IMPORT_SHEETS_FALLBACK,
  BUNDLE_REFERENCE_SHEETS,
  CLIENT_IMPORT_HEADERS,
  PRICE_IMPORT_HEADERS,
  type BundleTemplateSheet
} from "@/lib/initial-setup/bundle-template-sheets";
import { getStepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { getColdStartSteps } from "@/lib/initial-setup/flow-order";

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return String(v).trim();
}

function templateHeaders(stepId: string): string[] {
  const sheet =
    BUNDLE_REFERENCE_SHEETS.find((s) => s.sheetName === stepId) ??
    BUNDLE_IMPORT_SHEETS_FALLBACK.find((s) => s.sheetName === stepId);
  if (sheet?.rows[0]?.length) return [...sheet.rows[0]];
  const config = getStepTableConfig(stepId);
  return config?.columns.map((c) => c.header) ?? [];
}

function sheetFromObjects(stepId: string, items: Record<string, unknown>[]): BundleTemplateSheet | null {
  const config = getStepTableConfig(stepId);
  if (!config || !items.length) return null;
  const headers = templateHeaders(stepId);
  const keys = config.columns.map((c) => c.key);
  const rows = items.map((item) =>
    keys.map((k) => {
      if (k === "is_default") {
        const v = item[k];
        if (typeof v === "boolean") return v ? "1" : "0";
        return cellStr(v);
      }
      return cellStr(item[k]);
    })
  );
  return { sheetName: stepId, rows: [headers, ...rows] };
}

type ProfilePayload = {
  name?: string;
  phone?: string | null;
  address?: string | null;
  references?: Record<string, unknown>;
};

type CatalogRow = {
  name: string;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  is_active?: boolean;
};

async function fetchBlob(path: string): Promise<ArrayBuffer | null> {
  try {
    const { data } = await api.get(path, { responseType: "blob" });
    const blob = data instanceof Blob ? data : new Blob([data]);
    return blob.arrayBuffer();
  } catch {
    return null;
  }
}

function bufferToSheet(stepId: string, buf: ArrayBuffer): BundleTemplateSheet | null {
  try {
    const wb = XLSX.read(buf, { type: "array" });
    const sn = wb.SheetNames[0];
    if (!sn) return null;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn]!, {
      header: 1,
      defval: ""
    }) as unknown[][];
    const rows = matrix
      .map((line) => (line ?? []).map((c) => String(c ?? "").trim()))
      .filter((line) => line.some((c) => c.length > 0));
    if (!rows.length) return null;
    return { sheetName: stepId, rows };
  } catch {
    return null;
  }
}

async function fetchSheetFromBlob(stepId: string, path: string): Promise<BundleTemplateSheet | null> {
  const buf = await fetchBlob(path);
  if (!buf) return null;
  return bufferToSheet(stepId, buf);
}

async function fetchAllClients(tenantSlug: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const limit = 500;
  let page = 1;
  let total = Infinity;

  try {
    while (out.length < total && page <= 50) {
      const { data } = await api.get<{
        data: Array<Record<string, unknown>>;
        total: number;
      }>(`/api/${tenantSlug}/clients?page=${page}&limit=${limit}`);
      const batch = data.data ?? [];
      total = data.total ?? batch.length;
      for (const c of batch) {
        out.push({
          name: c.name,
          legal_name: c.legal_name,
          address: c.address,
          phone: c.phone,
          contact: c.responsible_person,
          landmark: c.landmark,
          inn: c.inn,
          pinfl: c.client_pinfl,
          sales_channel_code: c.sales_channel,
          client_category_code: c.category,
          client_type_code: c.client_type_code,
          format_code: c.client_format,
          city_code: c.city,
          latitude: c.latitude,
          longitude: c.longitude
        });
      }
      if (batch.length < limit) break;
      page += 1;
    }
  } catch {
    return out;
  }

  return out;
}

function clientsSheet(rows: Record<string, unknown>[]): BundleTemplateSheet | null {
  if (!rows.length) return null;
  const dataRows = rows.map((c) =>
    CLIENT_IMPORT_HEADERS.map((h) => {
      switch (h) {
        case "Наименование":
          return cellStr(c.name);
        case "Юридическое название":
          return cellStr(c.legal_name);
        case "Адрес":
          return cellStr(c.address);
        case "Телефон":
          return cellStr(c.phone);
        case "Контактное лицо":
          return cellStr(c.contact);
        case "Ориентир":
          return cellStr(c.landmark);
        case "ИНН":
          return cellStr(c.inn);
        case "ПИНФЛ":
          return cellStr(c.pinfl);
        case "Торговый канал (код)":
          return cellStr(c.sales_channel_code);
        case "Категория клиента (код)":
          return cellStr(c.client_category_code);
        case "Тип клиента (код)":
          return cellStr(c.client_type_code);
        case "Формат (код)":
          return cellStr(c.format_code);
        case "Город (код)":
          return cellStr(c.city_code);
        case "Широта":
          return cellStr(c.latitude);
        case "Долгота":
          return cellStr(c.longitude);
        default:
          return "";
      }
    })
  );
  return {
    sheetName: "clients",
    rows: [[...CLIENT_IMPORT_HEADERS], ...dataRows]
  };
}

async function fetchProductPricesSheet(tenantSlug: string, profile: ProfilePayload): Promise<BundleTemplateSheet | null> {
  try {
    const priceTypes =
      (profile.references?.price_type_entries as Array<{ code?: string }> | undefined)
        ?.map((p) => cellStr(p.code))
        .filter(Boolean) ?? [];

    const { data: catRes } = await api.get<{ data?: Array<{ id: number }> }>(
      `/api/${tenantSlug}/product-categories`
    );
    const categoryIds = (catRes.data ?? []).map((c) => c.id).filter((id) => id > 0);
    if (!categoryIds.length || !priceTypes.length) return null;

    const priceRows: string[][] = [];
    const chunkSize = 50;

    for (const priceType of priceTypes) {
      for (let i = 0; i < categoryIds.length; i += chunkSize) {
        const chunk = categoryIds.slice(i, i + chunkSize);
        try {
          const { data } = await api.get<{
            data: Array<{ sku: string; price: string | null }>;
          }>(
            `/api/${tenantSlug}/products/prices/matrix?price_type=${encodeURIComponent(priceType)}&category_ids=${chunk.join(",")}`
          );
          for (const row of data.data ?? []) {
            if (!row.sku || row.price == null) continue;
            priceRows.push([row.sku, priceType, row.price]);
          }
        } catch {
          /* skip chunk */
        }
      }
    }

    if (!priceRows.length) return null;
    return {
      sheetName: "product-prices",
      rows: [[...PRICE_IMPORT_HEADERS], ...priceRows]
    };
  } catch {
    return null;
  }
}

const EXPORT_SHEET_ORDER = [
  ...getColdStartSteps().map((s) => s.id),
  "products-catalog",
  "product-prices",
  "clients",
  "work-slots",
  "stock-receipts"
];

/** Joriy tizim ma’lumotlarini umumiy shablon formatida yig‘adi. */
export async function collectBundleExportSheets(tenantSlug: string): Promise<BundleTemplateSheet[]> {
  const sheets: BundleTemplateSheet[] = [];
  const byId = new Map<string, BundleTemplateSheet>();

  let profile: ProfilePayload = {};
  try {
    const profileRes = await api.get<ProfilePayload>(`/api/${tenantSlug}/settings/profile`);
    profile = profileRes.data;
  } catch {
    return sheets;
  }

  const [tdRes, scRes] = await Promise.all([
    api.get<{ data: CatalogRow[] }>(`/api/${tenantSlug}/trade-directions?is_active=true`).catch(() => ({
      data: { data: [] as CatalogRow[] }
    })),
    api.get<{ data: CatalogRow[] }>(`/api/${tenantSlug}/sales-channels?is_active=true`).catch(() => ({
      data: { data: [] as CatalogRow[] }
    }))
  ]);

  const refs = profile.references ?? {};

  if (profile.name?.trim()) {
    byId.set("company", {
      sheetName: "company",
      rows: [
        templateHeaders("company"),
        [profile.name, profile.phone ?? "", profile.address ?? ""]
      ]
    });
  }

  const profileSheets: Array<[string, string]> = [
    ["units", "unit_measures"],
    ["currencies", "currency_entries"],
    ["payment-methods", "payment_method_entries"],
    ["price-types", "price_type_entries"],
    ["branches", "branches"],
    ["client-formats", "client_format_entries"],
    ["client-types", "client_type_entries"],
    ["client-categories", "client_category_entries"]
  ];

  for (const [stepId, refKey] of profileSheets) {
    const raw = refs[refKey];
    if (!Array.isArray(raw) || !raw.length) continue;
    const items = raw.filter((x) => x != null && typeof x === "object" && !Array.isArray(x)) as Record<
      string,
      unknown
    >[];
    const sheet = sheetFromObjects(stepId, items);
    if (sheet) byId.set(stepId, sheet);
  }

  const tdItems = (tdRes.data.data ?? []).map((r) => ({
    name: r.name,
    code: r.code,
    sort_order: r.sort_order,
    comment: r.comment
  }));
  const tdSheet = sheetFromObjects("trade-directions", tdItems);
  if (tdSheet) byId.set("trade-directions", tdSheet);

  const scItems = (scRes.data.data ?? []).map((r) => ({
    name: r.name,
    code: r.code,
    sort_order: r.sort_order,
    comment: r.comment
  }));
  const scSheet = sheetFromObjects("sales-channels", scItems);
  if (scSheet) byId.set("sales-channels", scSheet);

  const productsSheet = await fetchSheetFromBlob(
    "products-catalog",
    `/api/${tenantSlug}/products/export-catalog`
  ).catch(() => null);
  const workSlotsSheet = await fetchSheetFromBlob(
    "work-slots",
    `/api/${tenantSlug}/work-slots/export.xlsx`
  ).catch(() => null);
  const clientsRaw = await fetchAllClients(tenantSlug);

  if (productsSheet && productsSheet.rows.length > 1) byId.set("products-catalog", productsSheet);

  const pricesSheet = await fetchProductPricesSheet(tenantSlug, profile);
  if (pricesSheet) byId.set("product-prices", pricesSheet);

  const clientsSheetData = clientsSheet(clientsRaw);
  if (clientsSheetData) byId.set("clients", clientsSheetData);

  if (workSlotsSheet && workSlotsSheet.rows.length > 1) byId.set("work-slots", workSlotsSheet);

  for (const stepId of EXPORT_SHEET_ORDER) {
    const sheet = byId.get(stepId);
    if (sheet && sheet.rows.length > 1) sheets.push(sheet);
  }

  return sheets;
}

export type BundleExportResult = {
  sheets: BundleTemplateSheet[];
  sheetCount: number;
  rowCounts: Record<string, number>;
};

export async function buildBundleExportData(tenantSlug: string): Promise<BundleExportResult> {
  const sheets = await collectBundleExportSheets(tenantSlug);
  const rowCounts: Record<string, number> = {};
  for (const s of sheets) {
    rowCounts[s.sheetName] = Math.max(0, s.rows.length - 1);
  }
  return { sheets, sheetCount: sheets.length, rowCounts };
}
