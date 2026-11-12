/**
 * SALEC AI Assistant — umumiy tiplar.
 *
 * Muhim: `AiActor.authorization` — foydalanuvchining o‘z JWT'si.
 * Yordamchi hech qachon "superuser" rejimida ishlamaydi.
 */

export type AiDomain =
  | "dashboard"
  | "sales"
  | "finance"
  | "orders"
  | "payments"
  | "clients"
  | "products"
  | "stock"
  | "staff"
  | "tasks"
  | "payroll"
  | "settings"
  | "system";

export type AiKind = "read" | "write";

/** Ichki HTTP chaqiruv uchun aktor. */
export type AiActor = {
  /** JWT `sub` — raqamga aylantirilgan (bo‘lmasa null). */
  userId: number | null;
  tenantId: number;
  tenantSlug: string;
  role: string;
  login?: string;
  /** Foydalanuvchining asl `Authorization` sarlavhasi (Bearer ...). */
  authorization: string;
};

/** Tool parametrlari — har bir tool o‘z zod sxemasi bilan validatsiya qiladi. */
export type AiParams = Record<string, unknown>;

/** Jadval guruhi — frontend shu shaklni chizadi. */
export type AiTableResult = {
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  /** Qo‘shimcha ko‘rsatkichlar (metric kartochkalari). */
  metrics?: Array<[string, string]>;
  /** Manba endpoint (audit / ishonch uchun). */
  source?: string;
  /** Qatorlar cheklangan bo‘lsa `true`. */
  truncated?: boolean;
};

export type AiToolCall = {
  tool: string;
  params: AiParams;
};

export type AiIntentName = string;

export type AiPlan = {
  intent: AiIntentName;
  calls: AiToolCall[];
  /** Foydalanuvchiga ko‘rsatiladigan tushuntirish (masalan, aniqlashtirish). */
  note?: string;
  source: "rules" | "llm";
};

export type AiDenied = { tool: string; reason: string };

export type AiAction = {
  kind: "confirm";
  tool: string;
  token: string;
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  expiresAt: string;
};

export type AiExportLink = {
  format: "xlsx" | "csv";
  url: string;
  rows: number;
  truncated: boolean;
};

export type AiAnswer = {
  title: string;
  intent: AiIntentName;
  summary: string[];
  /** Eski frontend uchun tekis matn. */
  lines: string[];
  groups: AiTableResult[];
  actions: AiAction[];
  denied: AiDenied[];
  export?: AiExportLink;
  meta: {
    tools: string[];
    durationMs: number;
    period?: { from?: string; to?: string };
    truncated: boolean;
  };
};

export type AiToolRunStatus = "ok" | "denied" | "error";

export type AiToolRun = {
  tool: string;
  status: AiToolRunStatus;
  statusCode: number;
  payload?: unknown;
  message?: string;
  durationMs: number;
};

export type AiSlots = {
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  page?: number;
  status?: string;
  priceType?: string;
  staffKind?: string;
  name?: string;
  login?: string;
  password?: string;
  phone?: string;
  role?: string;
  amount?: number;
  price?: number;
  quantity?: number;
  unit?: string;
  sku?: string;
  title?: string;
  active?: boolean;
  wantExport?: boolean;
  exportFormat?: "xlsx" | "csv";
  order_id?: number;
  return_id?: number;
  product_id?: number;
  branch_id?: number;
  year?: number;
  month?: number;
  /** Normallashtirilgan savol. */
  raw: string;
};
