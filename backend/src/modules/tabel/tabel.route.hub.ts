/**
 * «Табель и посещаемость» yon paneli va `/settings/tabel` API marshrutlari.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { storageReadBuffer } from "../../lib/storage.service";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  deleteTabelLocation,
  deleteTabelShift,
  getTabelSettingsForUi,
  listTabelLocations,
  getTabelPunchMediaKey,
  isTabelMediaSlot,
  listTabelMarks,
  listTabelShifts,
  patchTabelSettings,
  saveTabelLocation,
  saveTabelShift
} from "./tabel-hub.service";
import { buildTabelAnalyticsExportBuffer } from "./tabel-analytics-export";
import { buildTabelMarksExportBuffer } from "./tabel-marks-export";
import {
  createTabelAbsenceRequest,
  decideTabelAbsenceRequest,
  deleteTabelAbsenceRequest,
  listTabelAbsenceRequests,
  reviewTabelPunch
} from "./tabel-hub-requests";
import {
  createOrSyncClearanceSheet,
  getTabelAnalytics,
  listTabelClearanceSheets,
  updateTabelClearanceSheet
} from "./tabel-clearance-devices.service";
import { purgeTabelMediaAndFaces } from "./tabel-media-telegram.service";
import { listMissingCheckouts } from "./tabel-problems.service";
import { getVisitDashboard } from "./tabel-visit-dashboard.service";
import { closeEndedShiftsAndMarkAbsent } from "./tabel-shift-close.service";
import { registerTabelDeviceRoutes } from "./tabel.route.devices";

function actorLabel(request: FastifyRequest): string {
  const u = request.user as { role?: string; login?: string } | undefined;
  const role = u?.role?.trim();
  const login = u?.login?.trim();
  if (role && login) return `${role} (${login})`;
  return role || login || "система";
}

export async function registerTabelHubRoutes(app: FastifyInstance) {
  registerTabelDeviceRoutes(app);
  // ─────────── Настройки: Табель, Face ID и посещаемость ───────────
  app.get("/api/:slug/settings/tabel", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getTabelSettingsForUi(request.tenant!.id);
    return reply.send({ data });
  });

  app.put("/api/:slug/settings/tabel", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = (request.body && typeof request.body === "object" ? request.body : {}) as Record<string, unknown>;
    const data = await patchTabelSettings(request.tenant!.id, body, actorLabel(request));
    return reply.send({ data });
  });

  app.post("/api/:slug/settings/tabel/run-retention", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const [media, shifts] = await Promise.all([
      purgeTabelMediaAndFaces(request.tenant!.id),
      closeEndedShiftsAndMarkAbsent(request.tenant!.id)
    ]);
    return reply.send({ data: { ...media, ...shifts } });
  });

  app.get("/api/:slug/tabel/visit-dashboard", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as Record<string, unknown>;
    const data = await getVisitDashboard(request.tenant!.id, {
      date: typeof q.date === "string" ? q.date : undefined
    });
    return reply.send({ data });
  });

  // ─────────── Журнал отметок и Проблемные отметки ───────────
  app.get("/api/:slug/tabel/marks/export", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as Record<string, unknown>;
    const { buffer, filename } = await buildTabelMarksExportBuffer(request.tenant!.id, {
      from: typeof q.from === "string" ? q.from : undefined,
      to: typeof q.to === "string" ? q.to : undefined,
      user_id: q.user_id ? Number(q.user_id) : undefined,
      branch: typeof q.branch === "string" ? q.branch : undefined,
      source: typeof q.source === "string" ? q.source : undefined,
      only_problems: q.only_problems === "true" || q.only_problems === "1"
    });
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    return reply.send(buffer);
  });

  app.get("/api/:slug/tabel/marks", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as Record<string, unknown>;
    const items = await listTabelMarks(request.tenant!.id, {
      from: typeof q.from === "string" ? q.from : undefined,
      to: typeof q.to === "string" ? q.to : undefined,
      user_id: q.user_id ? Number(q.user_id) : undefined,
      branch: typeof q.branch === "string" ? q.branch : undefined,
      source: typeof q.source === "string" ? q.source : undefined,
      only_problems: q.only_problems === "true" || q.only_problems === "1"
    });
    return reply.send({ data: { items } });
  });

  app.get("/api/:slug/tabel/problems", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as Record<string, unknown>;
    const filters = {
      from: typeof q.from === "string" ? q.from : undefined,
      to: typeof q.to === "string" ? q.to : undefined,
      branch: typeof q.branch === "string" ? q.branch : undefined,
      source: typeof q.source === "string" ? q.source : undefined
    };
    const [items, openDays] = await Promise.all([
      listTabelMarks(request.tenant!.id, { ...filters, only_problems: true }),
      listMissingCheckouts(request.tenant!.id, filters)
    ]);
    return reply.send({ data: { items, open_days: openDays } });
  });

  app.post("/api/:slug/tabel/marks/:id/review", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { decision?: string; comment?: string };
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    const data = await reviewTabelPunch(
      request.tenant!.id,
      Number(id),
      decision,
      actorUserIdOrNull(request),
      body.comment
    );
    return reply.send({ data });
  });

  app.get("/api/:slug/tabel/marks/:id/media/:slot", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id, slot } = request.params as { id: string; slot: string };
    if (!isTabelMediaSlot(slot)) return sendApiError(reply, request, 400, "ValidationError", "Неизвестный слот медиа");
    const key = await getTabelPunchMediaKey(request.tenant!.id, Number(id), slot);
    if (!key) return sendApiError(reply, request, 404, "MediaNotFound");
    const buf = await storageReadBuffer(key);
    if (!buf) return sendApiError(reply, request, 404, "MediaNotFound");
    reply.header("Content-Type", slot.startsWith("video") ? "video/mp4" : "image/jpeg");
    return reply.send(buf);
  });

  // ─────────── Смены и Локации ───────────
  app.get("/api/:slug/tabel/shifts", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const items = await listTabelShifts(request.tenant!.id);
    return reply.send({ data: { items } });
  });

  app.post("/api/:slug/tabel/shifts", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = (request.body ?? {}) as Parameters<typeof saveTabelShift>[1];
    if (!body.name?.trim()) return sendApiError(reply, request, 400, "ValidationError", "Название смены обязательно");
    const data = await saveTabelShift(request.tenant!.id, body);
    return reply.send({ data });
  });

  app.delete("/api/:slug/tabel/shifts/:id", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const data = await deleteTabelShift(request.tenant!.id, Number(id));
    return reply.send({ data });
  });

  app.get("/api/:slug/tabel/locations", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const items = await listTabelLocations(request.tenant!.id);
    return reply.send({ data: { items } });
  });

  app.post("/api/:slug/tabel/locations", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = (request.body ?? {}) as Parameters<typeof saveTabelLocation>[1];
    if (!body.name?.trim()) return sendApiError(reply, request, 400, "ValidationError", "Название локации обязательно");
    const data = await saveTabelLocation(request.tenant!.id, body);
    return reply.send({ data });
  });

  app.delete("/api/:slug/tabel/locations/:id", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const data = await deleteTabelLocation(request.tenant!.id, Number(id));
    return reply.send({ data });
  });

  // ─────────── Заявки (Отпуск / Больничный / Командировка / Сверхурочные) ───────────
  app.get("/api/:slug/tabel/absence-requests", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as Record<string, unknown>;
    const items = await listTabelAbsenceRequests(request.tenant!.id, {
      status: typeof q.status === "string" ? q.status : undefined,
      type: typeof q.type === "string" ? q.type : undefined,
      user_id: q.user_id ? Number(q.user_id) : undefined,
      only_overtime: q.only_overtime === "true" ? true : q.only_overtime === "false" ? false : undefined
    });
    return reply.send({ data: { items } });
  });

  app.post("/api/:slug/tabel/absence-requests", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = (request.body ?? {}) as {
      user_id?: number;
      type?: string;
      from_date?: string;
      to_date?: string;
      hours?: number | null;
      reason?: string | null;
    };
    const uid = Number(body.user_id ?? actorUserIdOrNull(request) ?? 0);
    const type = (body.type ?? "").trim().toLowerCase();
    const absenceTypes = new Set(["vacation", "sick", "trip", "unpaid_leave"]);
    const overtimeTypes = new Set(["overtime", "weekend_work"]);
    if (!uid || !type || !body.from_date || !body.to_date) {
      return sendApiError(reply, request, 400, "ValidationError", "Заполните сотрудника, тип и даты");
    }
    if (!absenceTypes.has(type) && !overtimeTypes.has(type)) {
      return sendApiError(reply, request, 400, "ValidationError", "Неизвестный тип заявки");
    }
    if ((body.reason ?? "").trim().length < 3) {
      return sendApiError(reply, request, 400, "ValidationError", "Укажите причину");
    }
    if (overtimeTypes.has(type)) {
      const hours = Number(body.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        return sendApiError(reply, request, 400, "ValidationError", "Укажите часы от 0,5 до 24");
      }
    }
    try {
      const data = await createTabelAbsenceRequest(request.tenant!.id, uid, {
        type,
        from_date: body.from_date,
        to_date: body.to_date,
        hours: body.hours,
        reason: body.reason
      });
      return reply.send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "BAD_DATE_RANGE") return sendApiError(reply, request, 400, "ValidationError", "Проверьте даты");
      if (msg === "RANGE_TOO_LONG") return sendApiError(reply, request, 400, "ValidationError", "Период не длиннее 62 дней");
      throw e;
    }
  });

  app.post("/api/:slug/tabel/absence-requests/:id/:action", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id, action } = request.params as { id: string; action: string };
    const body = (request.body ?? {}) as { comment?: string };
    const decision = action === "reject" ? "rejected" : "approved";
    try {
      const data = await decideTabelAbsenceRequest(
        request.tenant!.id,
        Number(id),
        decision,
        actorUserIdOrNull(request),
        body.comment
      );
      return reply.send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound", "Заявка не найдена");
      if (msg === "ALREADY_DECIDED") return sendApiError(reply, request, 409, "Conflict", "Заявка уже решена");
      throw e;
    }
  });

  app.delete("/api/:slug/tabel/absence-requests/:id", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const data = await deleteTabelAbsenceRequest(request.tenant!.id, Number(id));
    return reply.send({ data });
  });

  // ─────────── Обходные листы / Терминалы / Аналитика ───────────
  app.get("/api/:slug/tabel/clearance-sheets", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as { status?: string };
    const items = await listTabelClearanceSheets(request.tenant!.id, q.status);
    return reply.send({ data: { items } });
  });

  app.post("/api/:slug/tabel/clearance-sheets", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = (request.body ?? {}) as { user_id?: number; comment?: string };
    if (!body.user_id) return sendApiError(reply, request, 400, "ValidationError", "Выберите сотрудника");
    if ((body.comment ?? "").trim().length < 3) {
      return sendApiError(reply, request, 400, "ValidationError", "Укажите причину");
    }
    try {
      const data = await createOrSyncClearanceSheet(request.tenant!.id, Number(body.user_id), body.comment);
      return reply.send({ data });
    } catch (err) {
      request.log.error({ err }, "clearance_sheet_create_failed");
      return sendApiError(reply, request, 500, "ClearanceCheckFailed", "Не удалось проверить долги сотрудника. Попробуйте ещё раз.");
    }
  });

  app.patch("/api/:slug/tabel/clearance-sheets/:id", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Parameters<typeof updateTabelClearanceSheet>[2];
    const data = await updateTabelClearanceSheet(request.tenant!.id, Number(id), body, actorUserIdOrNull(request));
    return reply.send({ data });
  });


  app.get("/api/:slug/tabel/analytics/export", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as { month?: string; branch?: string };
    const month = typeof q.month === "string" && /^\d{4}-\d{2}$/.test(q.month) ? q.month : new Date().toISOString().slice(0, 7);
    const branch = typeof q.branch === "string" && q.branch.trim() ? q.branch.trim() : undefined;
    const { buffer, filename } = await buildTabelAnalyticsExportBuffer(request.tenant!.id, month, branch);
    reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    return reply.send(buffer);
  });

  app.get("/api/:slug/tabel/analytics", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = (request.query ?? {}) as { month?: string; branch?: string };
    const month = typeof q.month === "string" && /^\d{4}-\d{2}$/.test(q.month) ? q.month : new Date().toISOString().slice(0, 7);
    const data = await getTabelAnalytics(request.tenant!.id, month, q.branch);
    return reply.send({ data });
  });
}
