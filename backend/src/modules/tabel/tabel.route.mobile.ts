/**
 * Mobil ilova va Terminal / Kiosk uchun davomat API marshrutlari (`/api/:slug/mobile/attendance/*`).
 */
import { createHash } from "crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify } from "../auth/auth.prehandlers";
import { toFio } from "../staff/staff.shared.helpers";
import { listTimesheetMatrix } from "../timesheet/timesheet.service";
import { createTabelAbsenceRequest, listTabelAbsenceRequests } from "./tabel-hub-requests";
import {
  getMobileAttendanceState,
  issueOrGetDayCode,
  submitAttendancePunch,
  type SubmitPunchInput
} from "./tabel-punch.service";

type PunchBody = SubmitPunchInput & { target_user_id?: number };

async function punchInputFromRequest(request: FastifyRequest): Promise<PunchBody> {
  if (!request.isMultipart()) return (request.body ?? {}) as PunchBody;
  const input: PunchBody = { source: "mobile_photo" };
  for await (const part of request.parts()) {
    if (part.type === "file") {
      const b64 = (await part.toBuffer()).toString("base64");
      if (part.fieldname.startsWith("photo_front")) input.photo_front_base64 = b64;
      else if (part.fieldname.startsWith("photo_back")) input.photo_back_base64 = b64;
      else if (part.fieldname.startsWith("video_front")) input.video_front_base64 = b64;
      else if (part.fieldname.startsWith("video_back")) input.video_back_base64 = b64;
      continue;
    }
    const name = part.fieldname;
    const value = String(part.value ?? "");
    if (name === "source" && (value === "mobile_photo" || value === "mobile_video" || value === "kiosk" || value === "terminal")) {
      input.source = value;
    } else if (name === "lat") input.lat = Number(value);
    else if (name === "lng") input.lng = Number(value);
    else if (name === "accuracy_m") input.accuracy_m = Number(value);
    else if (name === "is_mock_location") input.is_mock_location = value === "true" || value === "1";
    else if (name === "from_gallery") input.from_gallery = value === "true" || value === "1";
    else if (name === "client_timestamp") input.client_timestamp = value;
    else if (name === "comment") input.comment = value;
    else if (name === "spoken_code") input.spoken_code = Number(value);
    else if (name === "duration_sec") input.duration_sec = Number(value);
    else if (name === "capture_mode" && (value === "simultaneous" || value === "sequential")) input.capture_mode = value;
    else if (name === "face_count") input.face_count = Number(value);
    else if (name === "target_user_id") input.target_user_id = Number(value);
    else if (name === "liveness_steps") {
      try {
        input.liveness_steps = JSON.parse(value);
      } catch {
        input.liveness_steps = value.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  return input;
}

export async function registerTabelMobileRoutes(app: FastifyInstance) {
  app.get("/api/:slug/mobile/attendance/state", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getMobileAttendanceState(request.tenant!.id, Number(u.sub));
    return reply.send({ data });
  });

  app.get("/api/:slug/mobile/attendance/day-code", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const code = await issueOrGetDayCode(request.tenant!.id, Number(u.sub));
    return reply.send({ data: { day_code: code } });
  });

  app.post("/api/:slug/mobile/attendance/punch", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const body = await punchInputFromRequest(request);
    try {
      const data = await submitAttendancePunch(request.tenant!.id, Number(u.sub), {
        ...body,
        source: body.source ?? "mobile_photo"
      });
      return reply.send({ data });
    } catch (e) {
      const err = e as Error & { code?: string };
      return sendApiError(reply, request, 400, err.code ?? "AttendancePunchError", err.message);
    }
  });

  app.post("/api/:slug/mobile/attendance/video-punch", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const body = await punchInputFromRequest(request);
    try {
      const data = await submitAttendancePunch(request.tenant!.id, Number(u.sub), {
        ...body,
        source: "mobile_video"
      });
      return reply.send({ data });
    } catch (e) {
      const err = e as Error & { code?: string };
      return sendApiError(reply, request, 400, err.code ?? "VideoPunchError", err.message);
    }
  });

  app.get("/api/:slug/mobile/attendance/kiosk-team", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const leaderId = Number(u.sub);
    const staff = await prisma.user.findMany({
      where: {
        tenant_id: request.tenant!.id,
        is_active: true,
        NOT: { role: "admin" }
      },
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true, code: true },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }, { name: "asc" }],
      take: 200
    });
    return reply.send({
      data: {
        leader_id: leaderId,
        members: staff.map((s) => ({
          id: s.id,
          fio: toFio(s),
          role: s.role,
          branch: s.branch,
          code: s.code
        }))
      }
    });
  });

  app.post("/api/:slug/mobile/attendance/kiosk-punch", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const body = await punchInputFromRequest(request);
    const targetUserId = Number(body.target_user_id ?? u.sub);
    try {
      const data = await submitAttendancePunch(request.tenant!.id, targetUserId, {
        ...body,
        source: "kiosk",
        kiosk_leader_id: Number(u.sub)
      });
      return reply.send({ data });
    } catch (e) {
      const err = e as Error & { code?: string };
      return sendApiError(reply, request, 400, err.code ?? "KioskPunchError", err.message);
    }
  });

  app.get("/api/:slug/mobile/attendance/my-timesheet", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const q = (request.query ?? {}) as { month?: string };
    const month = typeof q.month === "string" && /^\d{4}-\d{2}$/.test(q.month) ? q.month : new Date().toISOString().slice(0, 7);
    const matrix = await listTimesheetMatrix(request.tenant!.id, { month, user_id: Number(u.sub) });
    return reply.send({ data: { month, row: matrix.rows[0] ?? null } });
  });

  app.get("/api/:slug/mobile/attendance/my-requests", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const items = await listTabelAbsenceRequests(request.tenant!.id, { user_id: Number(u.sub) });
    return reply.send({ data: { items } });
  });

  app.post("/api/:slug/mobile/attendance/my-requests", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const body = (request.body ?? {}) as {
      type?: string;
      from_date?: string;
      to_date?: string;
      hours?: number | null;
      reason?: string | null;
    };
    if (!body.type || !body.from_date || !body.to_date) {
      return sendApiError(reply, request, 400, "ValidationError", "Заполните тип и даты заявки");
    }
    const data = await createTabelAbsenceRequest(request.tenant!.id, Number(u.sub), {
      type: body.type,
      from_date: body.from_date,
      to_date: body.to_date,
      hours: body.hours,
      reason: body.reason
    });
    return reply.send({ data });
  });

  // Office-Link / Hikvision Terminal ingest
  app.post("/api/:slug/mobile/attendance/device-ingest", async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const rawHeader = request.headers["x-device-token"] ?? request.headers["x-attendance-token"];
    const token = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const body = (request.body ?? {}) as SubmitPunchInput & { user_id?: number; pairing_code?: string };

    let device = null;
    if (token) {
      const hash = createHash("sha256").update(String(token).trim()).digest("hex");
      device = await prisma.attendanceDevice.findFirst({
        where: { tenant_id: request.tenant!.id, device_token_hash: hash }
      });
    } else if (body.pairing_code) {
      device = await prisma.attendanceDevice.findFirst({
        where: { tenant_id: request.tenant!.id, pairing_code: String(body.pairing_code).trim() }
      });
    }
    if (!device || device.status === "revoked") {
      return sendApiError(reply, request, 401, "UnauthorizedDevice", "Терминал не авторизован");
    }
    await prisma.attendanceDevice.update({
      where: { id: device.id },
      data: { last_seen_at: new Date(), status: "online", is_confirmed: true }
    });
    if (!body.user_id) return reply.send({ data: { ok: true, device_id: device.id, status: "heartbeat" } });

    const data = await submitAttendancePunch(request.tenant!.id, Number(body.user_id), {
      ...body,
      source: "terminal",
      device_id: device.id
    });
    return reply.send({ data });
  });
}
