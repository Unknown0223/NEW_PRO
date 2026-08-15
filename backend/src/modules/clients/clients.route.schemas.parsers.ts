import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";
import { assertExcelImportSize } from "../../lib/multipart-limits";
import type { ListClientsQuery } from "./clients.service";
import { buildClientUpdateImportTemplateBuffer } from "./clients.service";

export async function sendClientUpdateImportTemplateXlsx(
  reply: FastifyReply,
  tenantId: number,
  q: ListClientsQuery
) {
  const buf = await buildClientUpdateImportTemplateBuffer(tenantId, q);
  return reply
    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header(
      "Content-Disposition",
      'attachment; filename="klientlarni_yangilash_Excel_shablon.xlsx"'
    )
    .send(buf);
}

type ClientImportMultipartOk = {
  buf: Buffer;
  sheetName?: string;
  headerRowIndex?: number;
  columnMap?: Record<string, number>;
  importMode?: "create" | "update";
  duplicateKeyFields?: string[];
  updateApplyFields?: string[];
};

export async function parseClientImportMultipart(request: FastifyRequest): Promise<ClientImportMultipartOk | null> {
  let buf: Buffer | null = null;
  let sheetName: string | undefined;
  let headerRowIndex: number | undefined;
  let columnMap: Record<string, number> | undefined;
  let importMode: "create" | "update" | undefined;
  let duplicateKeyFields: string[] | undefined;
  let updateApplyFields: string[] | undefined;

  const parts = request.parts({ limits: { fileSize: env.MULTIPART_EXCEL_MAX_BYTES } });
  for await (const part of parts) {
    if (part.type === "file") {
      buf = await part.toBuffer();
    } else if (part.type === "field") {
      if (part.fieldname === "sheetName") {
        const s = String(part.value ?? "").trim();
        if (s) sheetName = s;
      } else if (part.fieldname === "headerRowIndex") {
        const n = Number.parseInt(String(part.value ?? ""), 10);
        if (Number.isFinite(n) && n >= 0) headerRowIndex = n;
      } else if (part.fieldname === "columnMap") {
        try {
          const parsed = JSON.parse(String(part.value ?? "{}")) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            columnMap = parsed as Record<string, number>;
          }
        } catch {
          /* ignore */
        }
      } else if (part.fieldname === "importMode") {
        const m = String(part.value ?? "").trim().toLowerCase();
        if (m === "create" || m === "update") importMode = m;
      } else if (part.fieldname === "duplicateKeyFields") {
        try {
          const parsed = JSON.parse(String(part.value ?? "[]")) as unknown;
          if (Array.isArray(parsed)) duplicateKeyFields = parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
        } catch {
          /* ignore */
        }
      } else if (part.fieldname === "updateApplyFields") {
        try {
          const parsed = JSON.parse(String(part.value ?? "[]")) as unknown;
          if (Array.isArray(parsed)) updateApplyFields = parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (!buf || buf.length === 0) {
    return null;
  }
  assertExcelImportSize(buf.length);
  return { buf, sheetName, headerRowIndex, columnMap, importMode, duplicateKeyFields, updateApplyFields };
}

export function parseLocalYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function defaultReconciliationRange(): { from: Date; toEnd: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const toEnd = endOfLocalDay(now);
  return { from, toEnd };
}

function parsePositiveIntList(raw: string | undefined, maxItems = 40): number[] {
  if (!raw?.trim()) return [];
  const parsed = raw
    .split(/[,|]/)
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return [...new Set(parsed)].slice(0, maxItems);
}

function parseWeekdayList(raw: string | undefined): number[] {
  return parsePositiveIntList(raw, 7).filter((n) => n >= 1 && n <= 7);
}

function parseStringList(raw: string | undefined, maxItems = 30): string[] {
  if (!raw?.trim()) return [];
  const parsed = raw
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parsed)].slice(0, maxItems);
}

function mergeIntList(multiRaw: string | undefined, singleRaw: string | undefined): number[] {
  const fromMulti = parsePositiveIntList(multiRaw);
  if (fromMulti.length > 0) return fromMulti;
  if (singleRaw != null && singleRaw !== "") {
    const n = Number.parseInt(singleRaw, 10);
    if (Number.isFinite(n) && n > 0) return [n];
  }
  return [];
}

function mergeStringList(multiRaw: string | undefined, singleRaw: string | undefined): string[] {
  const fromMulti = parseStringList(multiRaw);
  if (fromMulti.length > 0) return fromMulti;
  const one = singleRaw?.trim();
  return one ? [one] : [];
}

const CLIENT_LIST_ALLOWED_SORT = new Set<string>([
  "name",
  "phone",
  "id",
  "created_at",
  "region",
  "legal_name",
  "address",
  "responsible_person",
  "landmark",
  "inn",
  "client_pinfl",
  "sales_channel",
  "category",
  "client_type_code",
  "client_format",
  "district",
  "neighborhood",
  "zone",
  "city",
  "client_code",
  "latitude",
  "longitude"
]);

export function parseClientListQuery(q: Record<string, string | undefined>): ListClientsQuery {
  const pageNum = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const mapMode = q.map === "1" || q.map === "true";
  const visitPlanner = q.visit_planner === "1" || q.visit_planner === "true";
  const maxLimit = visitPlanner ? 60_000 : mapMode ? 4000 : 100;
  const defaultLimit = visitPlanner ? 50_000 : mapMode ? 2500 : 50;
  const parsedLimit = Number.parseInt(q.limit ?? String(defaultLimit), 10) || defaultLimit;
  const limitNum = Math.min(maxLimit, Math.max(1, parsedLimit));
  const search = q.search?.trim() || undefined;
  let is_active: boolean | undefined;
  if (q.is_active === "true") is_active = true;
  else if (q.is_active === "false") is_active = false;
  const category = q.category?.trim() || undefined;
  const region = q.region?.trim() || undefined;
  const district = q.district?.trim() || undefined;
  const neighborhood = q.neighborhood?.trim() || undefined;
  const city = q.city?.trim() || undefined;
  const client_type_code = q.client_type_code?.trim() || undefined;
  const client_format = q.client_format?.trim() || undefined;
  const sales_channel = q.sales_channel?.trim() || undefined;
  const agent_ids = mergeIntList(q.agent_ids, q.agent_id);
  const agent_id = agent_ids.length === 1 ? agent_ids[0] : undefined;
  const expeditor_user_ids = mergeIntList(q.expeditor_user_ids, q.expeditor_user_id);
  const expeditor_user_id = expeditor_user_ids.length === 1 ? expeditor_user_ids[0] : undefined;
  const visit_weekdays = mergeIntList(q.visit_weekdays, q.visit_weekday).filter((n) => n >= 1 && n <= 7);
  const visit_weekday = visit_weekdays.length === 1 ? visit_weekdays[0] : undefined;
  const zones = mergeStringList(q.zones, q.zone);
  const zone = zones.length === 1 ? zones[0] : undefined;
  const inn = q.inn?.trim() || undefined;
  const phone = q.phone?.trim() || undefined;
  const client_pinfl = q.client_pinfl?.trim() || undefined;
  let has_active_equipment: boolean | undefined;
  if (q.has_active_equipment === "true") has_active_equipment = true;
  else if (q.has_active_equipment === "false") has_active_equipment = false;
  const equipment_kind = q.equipment_kind?.trim() || undefined;
  let has_credit: boolean | undefined;
  if (q.has_credit === "true") has_credit = true;
  else if (q.has_credit === "false") has_credit = false;
  let agent_consignment: "yes" | "no" | undefined;
  const acRaw = q.agent_consignment?.trim().toLowerCase();
  if (acRaw === "yes" || acRaw === "true" || acRaw === "1") agent_consignment = "yes";
  else if (acRaw === "no" || acRaw === "false" || acRaw === "0") agent_consignment = "no";
  let agent_consignment_limited: "yes" | "no" | undefined;
  const aclRaw = q.agent_consignment_limited?.trim().toLowerCase();
  if (aclRaw === "yes" || aclRaw === "true" || aclRaw === "1") agent_consignment_limited = "yes";
  else if (aclRaw === "no" || aclRaw === "false" || aclRaw === "0") agent_consignment_limited = "no";
  const created_from = q.created_from?.trim() || undefined;
  const created_to = q.created_to?.trim() || undefined;
  const supervisor_user_ids = mergeIntList(q.supervisor_user_ids, q.supervisor_user_id);
  const supervisor_user_id = supervisor_user_ids.length === 1 ? supervisor_user_ids[0] : undefined;
  let has_inn: boolean | undefined;
  if (q.has_inn === "true" || q.has_inn === "1") has_inn = true;
  else if (q.has_inn === "false" || q.has_inn === "0") has_inn = false;
  let has_phone: boolean | undefined;
  if (q.has_phone === "true" || q.has_phone === "1") has_phone = true;
  else if (q.has_phone === "false" || q.has_phone === "0") has_phone = false;
  const sortRaw = q.sort?.trim();
  const sort: NonNullable<ListClientsQuery["sort"]> =
    sortRaw && CLIENT_LIST_ALLOWED_SORT.has(sortRaw)
      ? (sortRaw as NonNullable<ListClientsQuery["sort"]>)
      : "name";
  const order = q.order === "desc" ? "desc" : "asc";
  const has_coords = q.has_coords === "1" || q.has_coords === "true";
  const missing_coords = q.missing_coords === "1" || q.missing_coords === "true";

  let client_ids: number[] | undefined;
  const rawClientIds = q.client_ids?.trim();
  if (rawClientIds) {
    const parsed = rawClientIds
      .split(/[, ]+/)
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);
    const uniq = [...new Set(parsed)];
    if (uniq.length > 0) client_ids = uniq.slice(0, 500);
  }

  const tagIdRaw = q.tag_id != null ? Number.parseInt(String(q.tag_id), 10) : NaN;
  const tag_id = Number.isFinite(tagIdRaw) && tagIdRaw > 0 ? tagIdRaw : undefined;
  const price_type = q.price_type?.trim() || undefined;
  let allow_order_with_debt: boolean | undefined;
  if (q.allow_order_with_debt === "true" || q.allow_order_with_debt === "1") allow_order_with_debt = true;
  else if (q.allow_order_with_debt === "false" || q.allow_order_with_debt === "0") allow_order_with_debt = false;

  return {
    page: pageNum,
    limit: limitNum,
    search,
    ...(is_active !== undefined ? { is_active } : {}),
    category,
    region,
    district,
    neighborhood,
    ...(zone ? { zone } : {}),
    ...(zones.length > 1 ? { zones } : {}),
    ...(city ? { city } : {}),
    ...(client_type_code ? { client_type_code } : {}),
    ...(client_format ? { client_format } : {}),
    ...(sales_channel ? { sales_channel } : {}),
    ...(agent_id !== undefined ? { agent_id } : {}),
    ...(agent_ids.length > 1 ? { agent_ids } : {}),
    ...(expeditor_user_id !== undefined ? { expeditor_user_id } : {}),
    ...(expeditor_user_ids.length > 1 ? { expeditor_user_ids } : {}),
    ...(visit_weekday !== undefined ? { visit_weekday } : {}),
    ...(visit_weekdays.length > 1 ? { visit_weekdays } : {}),
    ...(inn ? { inn } : {}),
    ...(phone ? { phone } : {}),
    ...(client_pinfl ? { client_pinfl } : {}),
    ...(has_active_equipment !== undefined ? { has_active_equipment } : {}),
    ...(equipment_kind ? { equipment_kind } : {}),
    ...(has_credit !== undefined ? { has_credit } : {}),
    ...(agent_consignment !== undefined ? { agent_consignment } : {}),
    ...(agent_consignment_limited !== undefined ? { agent_consignment_limited } : {}),
    ...(created_from ? { created_from } : {}),
    ...(created_to ? { created_to } : {}),
    ...(supervisor_user_id !== undefined ? { supervisor_user_id } : {}),
    ...(supervisor_user_ids.length > 1 ? { supervisor_user_ids } : {}),
    ...(has_inn !== undefined ? { has_inn } : {}),
    ...(has_phone !== undefined ? { has_phone } : {}),
    sort,
    order,
    ...(has_coords ? { has_coords: true } : {}),
    ...(missing_coords ? { missing_coords: true } : {}),
    ...(client_ids?.length ? { client_ids } : {}),
    ...(tag_id !== undefined ? { tag_id } : {}),
    ...(price_type ? { price_type } : {}),
    ...(allow_order_with_debt !== undefined ? { allow_order_with_debt } : {})
  };
}

export function parseReconciliationDateRange(
    q: Record<string, string | undefined>
  ):
    | { ok: true; dateFrom: Date; dateToEnd: Date }
    | { ok: false; status: number; error: string; message?: string } {
    if ((q.date_from && q.date_from.trim()) || (q.date_to && q.date_to.trim())) {
      if (!q.date_from?.trim() || !q.date_to?.trim()) {
        return {
          ok: false,
          status: 400,
          error: "DateRangeIncomplete",
          message: "date_from va date_to ikkalasi ham YYYY-MM-DD ko‘rinishida yuborilishi kerak."
        };
      }
      const a = parseLocalYmd(q.date_from);
      const b = parseLocalYmd(q.date_to);
      if (!a || !b) {
        return { ok: false, status: 400, error: "InvalidDate" };
      }
      const dateFrom = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0);
      const dateToEnd = endOfLocalDay(b);
      return { ok: true, dateFrom, dateToEnd };
    }
    const d = defaultReconciliationRange();
    return { ok: true, dateFrom: d.from, dateToEnd: d.toEnd };
  };
