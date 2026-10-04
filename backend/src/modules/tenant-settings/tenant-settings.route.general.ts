import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getMobileAppReleasePolicy,
  listMobileAppUsers,
  patchMobileAppReleasePolicy
} from "../mobile/app-release.service";
import { notifyAppUpdateToOutdatedUsers } from "../mobile/fcm-push.service";
import {
  buildMobileApkDownloadUrl,
  MOBILE_APK_MAX_BYTES,
  saveMobileApkStream
} from "../mobile/mobile-apk.service";
import { sendApiError, zodValidationExtras, zodValidationSummary } from "../../lib/api-error";
import { env } from "../../config/env";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";
import { getTenantProfile, patchTenantProfile } from "./tenant-settings.service";
import { buildInitialSetupExportBuffer } from "./initial-setup-export.service";
import { mobileAppReleasePatchSchema, profilePatchSchema } from "./tenant-settings.route.schemas";

const adminRoles = ["admin"] as const;
const profileReadRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

export async function registerTenantSettingsGeneralRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/settings/initial-setup/export-bundle.xlsx",
    { preHandler: [jwtAccessVerify, requireRoles(...profileReadRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      try {
        const buf = await buildInitialSetupExportBuffer(request.tenant!.id);
        const date = new Date().toISOString().slice(0, 10);
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
          .header(
            "Content-Disposition",
            `attachment; filename="nachalnaya-nastroyka-eksport-${date}.xlsx"`
          )
          .send(buf);
      } catch (e) {
        if (e instanceof Error && e.message === "EMPTY_EXPORT") {
          return sendApiError(
            reply,
            request,
            400,
            "EmptyExport",
            "Нет данных для экспорта — сначала заполните справочники"
          );
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/settings/profile",
    { preHandler: [jwtAccessVerify, requireRoles(...profileReadRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      try {
        const profile = await getTenantProfile(request.tenant!.id);
        return reply.send(profile);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/settings/profile",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = profilePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          zodValidationSummary(parsed.error),
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const profile = await patchTenantProfile(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(profile);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "TERRITORY_NODES_EMPTY_REJECTED") {
          return sendApiError(
            reply,
            request,
            400,
            "TerritoryNodesEmptyRejected",
            "Пустое дерево территорий не сохраняется, чтобы не удалить существующие данные."
          );
        }
        if (e instanceof Error && e.message.startsWith("REF_EMPTY_WIPE_REJECTED:")) {
          const field = e.message.split(":")[1] ?? "references";
          return sendApiError(
            reply,
            request,
            400,
            "RefEmptyWipeRejected",
            `Пустой справочник «${field}» не сохраняется, чтобы не удалить существующие данные.`
          );
        }
        if (e instanceof Error && e.message === "INVALID_BRANCH_CASH_DESK") {
          return sendApiError(reply, request, 400, "InvalidBranchCashDesk");
        }
        if (e instanceof Error && e.message === "DUPLICATE_BRANCH_CASH_DESK") {
          return sendApiError(reply, request, 400, "DuplicateBranchCashDesk");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/settings/mobile-app-release",
    { preHandler: [jwtAccessVerify, requireAnyPermission(["settings.mobile_app.view"])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const policy = await getMobileAppReleasePolicy(request.tenant!.id);
      const users = await listMobileAppUsers(request.tenant!.id);
      const outdated = users.filter((u) => u.is_outdated);
      const { mobileApkReady, buildMobileApkDownloadUrl } = await import("../mobile/mobile-apk.service");
      const {
        resolveRequestOrigin
      } = await import("../mobile/app-release.service");
      const apk = await mobileApkReady(request.tenant!.slug);
      const origin = resolveRequestOrigin(request.headers);
      reply.header("Cache-Control", "no-store");
      return reply.send({
        policy,
        users,
        users_count: users.length,
        outdated_count: outdated.length,
        outdated_users: outdated,
        apk: {
          ready: apk.ready,
          bytes: apk.bytes,
          mtime_ms: apk.mtime_ms,
          download_url: buildMobileApkDownloadUrl(origin, request.tenant!.slug)
        }
      });
    }
  );

  app.patch(
    "/api/:slug/settings/mobile-app-release",
    { preHandler: [jwtAccessVerify, requireAnyPermission(["settings.mobile_app.update"])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileAppReleasePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const policy = await patchMobileAppReleasePolicy(request.tenant!.id, parsed.data);
        return reply.send({ policy });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/settings/mobile-app-release/notify",
    { preHandler: [jwtAccessVerify, requireAnyPermission(["settings.mobile_app.transfer"])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const body = z
        .object({
          title: z.string().max(200).optional(),
          body: z.string().max(500).optional()
        })
        .strict()
        .safeParse(request.body ?? {});
      if (!body.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(body.error));
      }
      const policy = await getMobileAppReleasePolicy(request.tenant!.id);
      const result = await notifyAppUpdateToOutdatedUsers(request.tenant!.id, {
        title: body.data.title,
        body: body.data.body,
        latestVersion: policy.latest_version
      });
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/settings/mobile-app-release/upload",
    { preHandler: [jwtAccessVerify, requireAnyPermission(["settings.mobile_app.import"])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const file = await request.file({
        limits: { fileSize: env.MULTIPART_APK_MAX_BYTES }
      });
      if (!file) return sendApiError(reply, request, 400, "NoFile");
      const filename = (file.filename ?? "").toLowerCase();
      if (!filename.endsWith(".apk")) {
        return sendApiError(reply, request, 400, "InvalidFile", "Загрузите файл .apk");
      }
      try {
        const bytes = await saveMobileApkStream(request.tenant!.slug, file.file);
        const protoHeader = request.headers["x-forwarded-proto"];
        const proto = typeof protoHeader === "string" ? protoHeader.split(",")[0]?.trim() : "https";
        const hostHeader = request.headers["x-forwarded-host"] ?? request.headers.host;
        const host = typeof hostHeader === "string" ? hostHeader.split(",")[0]?.trim() : "localhost";
        const origin = `${proto || "https"}://${host}`;
        const downloadUrl = buildMobileApkDownloadUrl(origin, request.tenant!.slug);
        const verFromFilename = filename.match(/(\d+\.\d+\.\d+)/)?.[1] ?? null;
        const prev = await getMobileAppReleasePolicy(request.tenant!.id);
        const policy = await patchMobileAppReleasePolicy(request.tenant!.id, {
          download_url: downloadUrl,
          // Soft OTA: majburiy emas — faqat latest yangilanadi; min saqlanadi.
          // Majburiy bloklash: vebda «Majburiy yangilash» yoki PATCH force_update=true.
          force_update: false,
          ...(verFromFilename
            ? {
                latest_version: verFromFilename,
                // min_version ni avtomatik ko‘tarmaymiz — aks holda hammaga «required» bo‘ladi.
                ...(prev.min_version ? {} : { min_version: null })
              }
            : {})
        });
        return reply.send({
          policy,
          download_url: downloadUrl,
          bytes,
          max_bytes: MOBILE_APK_MAX_BYTES,
          apk: { ready: true, bytes }
        });
      } catch (e) {
        if (e instanceof Error && e.message === "FILE_TOO_LARGE") {
          return sendApiError(
            reply,
            request,
            413,
            "PayloadTooLarge",
            `Размер APK не должен превышать ${Math.round(MOBILE_APK_MAX_BYTES / (1024 * 1024))} МБ`
          );
        }
        throw e;
      }
    }
  );
}
