import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getMobileAppReleasePolicy,
  listOutdatedMobileUsers,
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
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
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
            "Bo‘sh territoriya daraxti saqlanmaydi — mavjud ma’lumot o‘chib ketmasin."
          );
        }
        if (e instanceof Error && e.message.startsWith("REF_EMPTY_WIPE_REJECTED:")) {
          const field = e.message.split(":")[1] ?? "references";
          return sendApiError(
            reply,
            request,
            400,
            "RefEmptyWipeRejected",
            `Bo‘sh «${field}» saqlanmaydi — mavjud spravochnik o‘chib ketmasin.`
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
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const policy = await getMobileAppReleasePolicy(request.tenant!.id);
      const outdated = await listOutdatedMobileUsers(request.tenant!.id);
      return reply.send({ policy, outdated_count: outdated.length, outdated_users: outdated });
    }
  );

  app.patch(
    "/api/:slug/settings/mobile-app-release",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
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
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
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
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const file = await request.file({
        limits: { fileSize: env.MULTIPART_APK_MAX_BYTES }
      });
      if (!file) return sendApiError(reply, request, 400, "NoFile");
      const filename = (file.filename ?? "").toLowerCase();
      if (!filename.endsWith(".apk")) {
        return sendApiError(reply, request, 400, "InvalidFile", "Faqat .apk fayl yuklang");
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
        const policy = await patchMobileAppReleasePolicy(request.tenant!.id, {
          download_url: downloadUrl,
          ...(verFromFilename ? { latest_version: verFromFilename } : {})
        });
        return reply.send({
          policy,
          download_url: downloadUrl,
          bytes,
          max_bytes: MOBILE_APK_MAX_BYTES
        });
      } catch (e) {
        if (e instanceof Error && e.message === "FILE_TOO_LARGE") {
          return sendApiError(
            reply,
            request,
            413,
            "PayloadTooLarge",
            `APK hajmi ${Math.round(MOBILE_APK_MAX_BYTES / (1024 * 1024))} MB dan oshmasligi kerak`
          );
        }
        throw e;
      }
    }
  );
}
