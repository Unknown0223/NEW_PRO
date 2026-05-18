import type { FastifyReply, FastifyRequest } from "fastify";
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

  const parts = request.parts();
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
  const maxLimit = mapMode ? 4000 : 100;
  const defaultLimit = mapMode ? 2500 : 50;
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
  const zone = q.zone?.trim() || undefined;
  const city = q.city?.trim() || undefined;
  const client_type_code = q.client_type_code?.trim() || undefined;
  const client_format = q.client_format?.trim() || undefined;
  const sales_channel = q.sales_channel?.trim() || undefined;
  let agent_id: number | undefined;
  if (q.agent_id != null && q.agent_id !== "") {
    const n = Number.parseInt(q.agent_id, 10);
    if (Number.isFinite(n) && n > 0) agent_id = n;
  }
  let expeditor_user_id: number | undefined;
  if (q.expeditor_user_id != null && q.expeditor_user_id !== "") {
    const n = Number.parseInt(q.expeditor_user_id, 10);
    if (Number.isFinite(n) && n > 0) expeditor_user_id = n;
  }
  let visit_weekday: number | undefined;
  if (q.visit_weekday != null && q.visit_weekday !== "") {
    const n = Number.parseInt(q.visit_weekday, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 7) visit_weekday = n;
  }
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
  let supervisor_user_id: number | undefined;
  if (q.supervisor_user_id != null && q.supervisor_user_id !== "") {
    const n = Number.parseInt(q.supervisor_user_id, 10);
    if (Number.isFinite(n) && n > 0) supervisor_user_id = n;
  }
  const sortRaw = q.sort?.trim();
  const sort: NonNullable<ListClientsQuery["sort"]> =
    sortRaw && CLIENT_LIST_ALLOWED_SORT.has(sortRaw)
      ? (sortRaw as NonNullable<ListClientsQuery["sort"]>)
      : "name";
  const order = q.order === "desc" ? "desc" : "asc";
  const has_coords = q.has_coords === "1" || q.has_coords === "true";

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
    ...(city ? { city } : {}),
    ...(client_type_code ? { client_type_code } : {}),
    ...(client_format ? { client_format } : {}),
    ...(sales_channel ? { sales_channel } : {}),
    ...(agent_id !== undefined ? { agent_id } : {}),
    ...(expeditor_user_id !== undefined ? { expeditor_user_id } : {}),
    ...(visit_weekday !== undefined ? { visit_weekday } : {}),
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
    sort,
    order,
    ...(has_coords ? { has_coords: true } : {}),
    ...(client_ids?.length ? { client_ids } : {})
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
