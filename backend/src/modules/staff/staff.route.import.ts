/**
 * Staff Excel import HTTP routes — template + upsert per role path.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras, zodValidationSummary } from "../../lib/api-error";
import { assertExcelImportSize, ExcelImportTooLargeError } from "../../lib/multipart-limits";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./staff.route.shared";
import {
  STAFF_IMPORT_KINDS,
  STAFF_IMPORT_ROUTE_BASE,
  STAFF_OFFICE_IMPORT_SHEETS,
  isStaffImportKind,
  isStaffOfficeWebRole,
  wantsAllRoles,
  type StaffImportKind,
  type StaffOfficeWebRole
} from "./staff.import.kinds";
import {
  importStaffFromXlsxBuffer,
  importStaffWorkbookFromXlsxBuffer
} from "./staff.import.service";
import {
  buildStaffImportAllRolesTemplateBuffer,
  buildStaffImportOfficeRoleTemplateBuffer,
  buildStaffImportTemplateBuffer,
  staffImportAllRolesTemplateFilename,
  staffImportOfficeTemplateFilename,
  staffImportTemplateFilename
} from "./staff.import.template";

const OFFICE_WEB_ROLES = STAFF_OFFICE_IMPORT_SHEETS.map((s) => s.webRole) as [
  StaffOfficeWebRole,
  ...StaffOfficeWebRole[]
];

/** Accepts ?kind=agent|…|all|manager|… and/or ?mode=all (work-slots «Все роли»). */
const kindOrAllSchema = z.object({
  kind: z
    .union([z.enum(STAFF_IMPORT_KINDS), z.enum(OFFICE_WEB_ROLES), z.literal("all")])
    .optional(),
  mode: z.enum(["all", "single"]).optional(),
  sheet: z.string().min(1).max(64).optional()
});

async function readImportBuffer(
  request: FastifyRequest
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: "NoFile" | "EmptyFile" | "TooLarge" }> {
  try {
    const file = await request.file();
    if (!file) return { ok: false, error: "NoFile" };
    const buf = await file.toBuffer();
    if (buf.length === 0) return { ok: false, error: "EmptyFile" };
    assertExcelImportSize(buf.length);
    return { ok: true, buf };
  } catch (e) {
    if (e instanceof ExcelImportTooLargeError) return { ok: false, error: "TooLarge" };
    throw e;
  }
}

function sendImportError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  e: unknown
): ReturnType<typeof sendApiError> | never {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "EMPTY_FILE") return sendApiError(reply, request, 400, "EmptyFile");
  if (msg === "TOO_MANY_ROWS") return sendApiError(reply, request, 400, "TooManyRows");
  if (msg === "MISSING_FIO_COLUMN") {
    return sendApiError(
      reply,
      request,
      400,
      "ValidationError",
      "В Excel не найдена колонка «Ф.И.О»"
    );
  }
  throw e;
}

async function handleTemplate(
  reply: Parameters<typeof sendApiError>[0],
  kind: StaffImportKind
) {
  const buf = buildStaffImportTemplateBuffer(kind);
  reply
    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("Content-Disposition", `attachment; filename="${staffImportTemplateFilename(kind)}"`);
  return reply.send(buf);
}

async function handleOfficeTemplate(
  reply: Parameters<typeof sendApiError>[0],
  webRole: StaffOfficeWebRole
) {
  const buf = buildStaffImportOfficeRoleTemplateBuffer(webRole);
  reply
    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header(
      "Content-Disposition",
      `attachment; filename="${staffImportOfficeTemplateFilename(webRole)}"`
    );
  return reply.send(buf);
}

async function handleAllRolesTemplate(reply: Parameters<typeof sendApiError>[0]) {
  const buf = buildStaffImportAllRolesTemplateBuffer();
  reply
    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .header("Content-Disposition", `attachment; filename="${staffImportAllRolesTemplateFilename()}"`);
  return reply.send(buf);
}

async function handleImport(
  request: FastifyRequest,
  reply: Parameters<typeof sendApiError>[0],
  kind: StaffImportKind,
  sheetName?: string
) {
  const read = await readImportBuffer(request);
  if (!read.ok) {
    if (read.error === "NoFile") return sendApiError(reply, request, 400, "NoFile");
    if (read.error === "TooLarge") return sendApiError(reply, request, 400, "FileTooLarge");
    return sendApiError(reply, request, 400, "EmptyFile");
  }
  try {
    const result = await importStaffFromXlsxBuffer(
      request.tenant!.id,
      kind,
      read.buf,
      actorUserIdOrNull(request),
      sheetName ? { sheetName } : undefined
    );
    return reply.send({ data: result });
  } catch (e) {
    return sendImportError(reply, request, e);
  }
}

async function handleAllRolesImport(
  request: FastifyRequest,
  reply: Parameters<typeof sendApiError>[0]
) {
  const read = await readImportBuffer(request);
  if (!read.ok) {
    if (read.error === "NoFile") return sendApiError(reply, request, 400, "NoFile");
    if (read.error === "TooLarge") return sendApiError(reply, request, 400, "FileTooLarge");
    return sendApiError(reply, request, 400, "EmptyFile");
  }
  try {
    const result = await importStaffWorkbookFromXlsxBuffer(
      request.tenant!.id,
      read.buf,
      actorUserIdOrNull(request)
    );
    return reply.send({ data: result });
  } catch (e) {
    return sendImportError(reply, request, e);
  }
}

export async function registerStaffImportRoutes(app: FastifyInstance) {
  const pre = [jwtAccessVerify, requireRoles(...catalogRoles)] as const;

  // Shared: ?kind=agent|…|all  OR  ?mode=all
  app.get(
    "/api/:slug/staff/import/template",
    { preHandler: [...pre] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = kindOrAllSchema.safeParse(request.query);
      if (!q.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          zodValidationSummary(q.error, "Укажите ?kind=agent|… или ?mode=all"),
          zodValidationExtras(q.error)
        );
      }
      if (wantsAllRoles(q.data)) {
        return handleAllRolesTemplate(reply);
      }
      if (!q.data.kind || q.data.kind === "all") {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Укажите ?kind=agent|… или ?mode=all"
        );
      }
      if (isStaffOfficeWebRole(q.data.kind) && q.data.kind !== "operator") {
        return handleOfficeTemplate(reply, q.data.kind);
      }
      if (isStaffImportKind(q.data.kind)) {
        return handleTemplate(reply, q.data.kind);
      }
      return sendApiError(reply, request, 400, "ValidationError", "Неизвестный kind");
    }
  );

  app.post(
    "/api/:slug/staff/import.xlsx",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = kindOrAllSchema.safeParse(request.query);
      if (!q.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          zodValidationSummary(q.error, "Укажите ?kind=agent|… или ?mode=all"),
          zodValidationExtras(q.error)
        );
      }
      if (wantsAllRoles(q.data)) {
        return handleAllRolesImport(request, reply);
      }
      if (!q.data.kind || q.data.kind === "all") {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Укажите ?kind=agent|… или ?mode=all"
        );
      }
      // Office web-roles import via operator engine
      if (isStaffOfficeWebRole(q.data.kind)) {
        const office = q.data.kind;
        const sheetHint =
          q.data.sheet ??
          STAFF_OFFICE_IMPORT_SHEETS.find((s) => s.webRole === office)?.sheetName;
        const read = await readImportBuffer(request);
        if (!read.ok) {
          if (read.error === "NoFile") return sendApiError(reply, request, 400, "NoFile");
          if (read.error === "TooLarge") return sendApiError(reply, request, 400, "FileTooLarge");
          return sendApiError(reply, request, 400, "EmptyFile");
        }
        try {
          const result = await importStaffFromXlsxBuffer(
            request.tenant!.id,
            "operator",
            read.buf,
            actorUserIdOrNull(request),
            { sheetName: sheetHint, defaultWebRole: office }
          );
          return reply.send({ data: result });
        } catch (e) {
          return sendImportError(reply, request, e);
        }
      }
      return handleImport(request, reply, q.data.kind, q.data.sheet);
    }
  );

  // Per-role aliases (RBAC maps /agents → staff.agent.*, etc.)
  for (const kind of STAFF_IMPORT_KINDS) {
    const base = STAFF_IMPORT_ROUTE_BASE[kind];

    app.get(
      `/api/:slug/${base}/import/template`,
      { preHandler: [...pre] },
      async (request, reply) => {
        if (!ensureTenantContext(request, reply)) return;
        return handleTemplate(reply, kind);
      }
    );

    app.post(
      `/api/:slug/${base}/import.xlsx`,
      { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
      async (request, reply) => {
        if (!ensureTenantContext(request, reply)) return;
        const q = z.object({ sheet: z.string().min(1).max(64).optional() }).safeParse(request.query);
        return handleImport(request, reply, kind, q.success ? q.data.sheet : undefined);
      }
    );
  }
}

export function parseStaffImportKindParam(raw: string | undefined): StaffImportKind | null {
  if (!raw || !isStaffImportKind(raw)) return null;
  return raw;
}
