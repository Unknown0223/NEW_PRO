/**
 * Terminal Face ID marshrutlari.
 */
import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  confirmTabelDeviceLink,
  createTabelDevice,
  deleteTabelDevice,
  issueTabelDeviceToken,
  listDeviceFaceSyncPeople,
  listTabelDevices,
  readDeviceFaceSyncImage,
  syncFacesToTabelDevice,
  updateTabelDevice
} from "./tabel-clearance-devices.service";

export async function registerTabelDeviceRoutes(app: FastifyInstance) {
  app.get("/api/:slug/tabel/devices", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const items = await listTabelDevices(request.tenant!.id);
    return reply.send({ data: { items } });
  });

  app.post("/api/:slug/tabel/devices", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const body = (request.body ?? {}) as Parameters<typeof createTabelDevice>[1];
    if (!body.name?.trim()) return sendApiError(reply, request, 400, "ValidationError", "Название терминала обязательно");
    const data = await createTabelDevice(request.tenant!.id, body);
    return reply.send({ data });
  });

  app.patch("/api/:slug/tabel/devices/:id", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Parameters<typeof updateTabelDevice>[2];
    const data = await updateTabelDevice(request.tenant!.id, Number(id), body);
    return reply.send({ data });
  });

  app.post("/api/:slug/tabel/devices/:id/confirm", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const data = await confirmTabelDeviceLink(request.tenant!.id, Number(id));
      return reply.send({ data });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        return sendApiError(reply, request, 404, "NotFound", "Терминал не найден");
      }
      return sendApiError(reply, request, 409, "NotPending", "Подтверждать можно только запрос на подключение.");
    }
  });

  app.post("/api/:slug/tabel/devices/:id/issue-token", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const data = await issueTabelDeviceToken(request.tenant!.id, Number(id));
      return reply.send({ data });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        return sendApiError(reply, request, 404, "NotFound", "Терминал не найден");
      }
      if (err instanceof Error && err.message === "DEVICE_NOT_LINKED") {
        return sendApiError(
          reply,
          request,
          409,
          "DeviceNotLinked",
          "Токен можно создать только после полного подключения терминала."
        );
      }
      throw err;
    }
  });

  app.get("/api/:slug/tabel/devices/:id/face-sync", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    try {
      const data = await listDeviceFaceSyncPeople(request.tenant!.id, Number(id));
      return reply.send({ data });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound", "Терминал не найден");
      throw err;
    }
  });

  app.get("/api/:slug/tabel/devices/:id/face-sync/:userId", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id, userId } = request.params as { id: string; userId: string };
    try {
      const data = await readDeviceFaceSyncImage(request.tenant!.id, Number(id), Number(userId));
      return reply.send({ data });
    } catch (err) {
      if (err instanceof Error && err.message === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound", "Фото не найдено");
      throw err;
    }
  });

  app.post("/api/:slug/tabel/devices/:id/sync-faces", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const data = await syncFacesToTabelDevice(request.tenant!.id, Number(id));
    return reply.send({ data });
  });

  app.delete("/api/:slug/tabel/devices/:id", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const { id } = request.params as { id: string };
    const data = await deleteTabelDevice(request.tenant!.id, Number(id));
    return reply.send({ data });
  });
}
