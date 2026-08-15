/**
 * Staff Excel import HTTP routes — template + upsert per role path.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { assertExcelImportSize, ExcelImportTooLargeError } from "../../lib/multipart-limits";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./staff.route.shared";
import {
  STAFF_IMPORT_KINDS,
  STAFF_IMPORT_ROUTE_BASE,
  isStaffImportKind,
  type StaffImportKind
} from "./staff.import.kinds";
import { importStaffFromXlsxBuffer } from "./staff.import.service";
import { buildStaffImportTemplateBuffer, staffImportTemplateFilename } from "./staff.import.template";

const kindQuerySchema = z.object({
  kind: z.enum(STAFF_IMPORT_KINDS)
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

async function handleImport(
  request: FastifyRequest,
  reply: Parameters<typeof sendApiError>[0],
  kind: StaffImportKind
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
      actorUserIdOrNull(request)
    );
    return reply.send({ data: result });
  } catch (e) {
    return sendImportError(reply, request, e);
  }
}

export async function registerStaffImportRoutes(app: FastifyInstance) {
  const pre = [jwtAccessVerify, requireRoles(...catalogRoles)] as const;

  // Shared: ?kind=agent|expeditor|…
  app.get(
    "/api/:slug/staff/import/template",
    { preHandler: [...pre] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = kindQuerySchema.safeParse(request.query);
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
      }
      return handleTemplate(reply, q.data.kind);
    }
  );

  app.post(
    "/api/:slug/staff/import.xlsx",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = kindQuerySchema.safeParse(request.query);
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(q.error));
      }
      return handleImport(request, reply, q.data.kind);
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
        return handleImport(request, reply, kind);
      }
    );
  }
}

export function parseStaffImportKindParam(raw: string | undefined): StaffImportKind | null {
  if (!raw || !isStaffImportKind(raw)) return null;
  return raw;
}
