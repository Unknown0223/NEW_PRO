/** Maksimal o‘lchov maydonlari (qator + ustun). */
export const REPORT_BUILDER_MAX_DIMENSIONS = 6;
/** Qator maydonlari soni chegarasi. */
export const REPORT_BUILDER_MAX_ROW_FIELDS = 5;
/** Ustun maydonlari soni chegarasi (pivot). */
export const REPORT_BUILDER_MAX_COL_FIELDS = 3;
export const REPORT_BUILDER_PREVIEW_ROW_CAP = 5000;
export const REPORT_BUILDER_EXPORT_ROW_CAP = 20000;
/** WebDataRocks uchun xom qatorlar (client-side pivot) — yuqori cheklov. */
export const REPORT_BUILDER_DATASET_ROW_CAP = 50000;
/** Ekran uchun birinchi sahifa. */
export const REPORT_BUILDER_DATASET_PAGE_SIZE = 1000;
/** Scroll chegaraiga yetganda keyingi sahifalar. */
export const REPORT_BUILDER_DATASET_SCROLL_PAGE_SIZE = 500;

export const DATASET_ORDERS_SALES_LINES = "orders_sales_lines" as const;

/** Filtr massivlari maks. uzunligi (DoS oldini olish). */
export const REPORT_BUILDER_MAX_FILTER_IDS = 500;
