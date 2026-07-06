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
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { env } from "../../config/env";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  getTenantBonusStack,
  getTenantProfile,
  patchTenantProfile,
  updateTenantBonusStack
} from "./tenant-settings.service";
import { buildInitialSetupExportBuffer } from "./initial-setup-export.service";

const adminRoles = ["admin"] as const;
const profileReadRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const bonusStackReadRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

type TerritoryNodePatch = {
  id: string;
  name: string;
  code?: string | null;
  comment?: string | null;
  sort_order?: number | null;
  active?: boolean;
  children: TerritoryNodePatch[];
};

type UnitMeasurePatch = {
  id: string;
  name: string;
  title?: string | null;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
};

type BranchPatch = {
  id: string;
  name: string;
  code?: string | null;
  sort_order?: number | null;
  comment?: string | null;
  active?: boolean;
  territories?: string[];
  cities?: string[];
  cash_desk_ids?: number[];
  territory?: string | null;
  city?: string | null;
  cashbox?: string | null;
  cash_desk_id?: number | null;
  user_links?: {
    role: string;
    user_ids: number[];
  }[];
};

const territoryNodeSchema: z.ZodType<TerritoryNodePatch> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(128),
    name: z.string().min(1).max(500),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_]+$/)
      .max(20)
      .nullable()
      .optional(),
    comment: z.string().max(4000).nullable().optional(),
    sort_order: z.number().int().nullable().optional(),
    active: z.boolean().optional(),
    children: z.array(territoryNodeSchema).max(200)
  })
);

const unitMeasureSchema: z.ZodType<UnitMeasurePatch> = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  title: z.string().max(500).nullable().optional(),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]+$/)
    .max(20)
    .nullable()
    .optional(),
  sort_order: z.number().int().nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional()
});

const clientRefEntrySchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]+$/)
    .max(20)
    .nullable()
    .optional(),
  sort_order: z.number().int().nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  color: z.string().max(32).nullable().optional()
});

const currencyEntrySchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  code: z.string().trim().min(2).max(20),
  sort_order: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
  is_default: z.boolean().optional()
});

const paymentMethodEntrySchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  code: z.string().trim().max(30).nullable().optional(),
  currency_code: z.string().trim().min(2).max(20),
  sort_order: z.number().int().nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  active: z.boolean().optional()
});

const priceTypeEntrySchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  code: z.string().trim().max(20).nullable().optional(),
  payment_method_id: z.string().min(1).max(128),
  kind: z.enum(["sale", "purchase"]).optional(),
  sort_order: z.number().int().nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  manual: z.boolean().optional(),
  attached_clients_only: z.boolean().optional()
});

const branchSchema: z.ZodType<BranchPatch> = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(500),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]+$/)
    .max(20)
    .nullable()
    .optional(),
  sort_order: z.number().int().nullable().optional(),
  comment: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  territories: z.array(z.string().trim().min(1).max(500)).max(200).optional(),
  cities: z.array(z.string().trim().min(1).max(500)).max(500).optional(),
  cash_desk_ids: z.array(z.number().int().positive()).max(50).optional(),
  territory: z.string().max(500).nullable().optional(),
  city: z.string().max(500).nullable().optional(),
  cashbox: z.string().max(500).nullable().optional(),
  cash_desk_id: z.number().int().positive().nullable().optional(),
  user_links: z
    .array(
      z.object({
        role: z.string().min(1).max(100),
        user_ids: z.array(z.number().int().positive()).max(2000)
      })
    )
    .max(100)
    .optional()
});

const returnFilterSchema = z.object({
  period_enabled: z.boolean(),
  period_unit: z.enum(["day", "month"]),
  period_value: z.number().int().min(1).max(365),
  balance_zero_enabled: z.boolean()
});

const profilePatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().max(500).nullable().optional(),
    address: z.string().max(4000).nullable().optional(),
    logo_url: z.string().max(4000).nullable().optional(),
    feature_flags: z.record(z.string(), z.unknown()).optional(),
    return_filter: returnFilterSchema.optional(),
    references: z
      .object({
        payment_types: z.array(z.string()).optional(),
        return_reasons: z.array(z.string()).optional(),
        regions: z.array(z.string()).optional(),
        client_categories: z.array(z.string()).optional(),
        client_type_codes: z.array(z.string()).optional(),
        client_formats: z.array(z.string()).optional(),
        sales_channels: z.array(z.string()).optional(),
        client_product_category_refs: z.array(z.string()).optional(),
        client_districts: z.array(z.string()).optional(),
        client_cities: z.array(z.string()).optional(),
        client_neighborhoods: z.array(z.string()).optional(),
        client_zones: z.array(z.string()).optional(),
        client_logistics_services: z.array(z.string()).optional(),
        territory_levels: z.array(z.string()).optional(),
        territory_nodes: z.array(territoryNodeSchema).max(120).optional(),
        unit_measures: z.array(unitMeasureSchema).max(1000).optional(),
        branches: z.array(branchSchema).max(1000).optional(),
        client_format_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        client_type_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        client_category_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        territory_tree: z
          .array(
            z.object({
              zone: z.string(),
              region: z.string(),
              cities: z.array(z.string())
            })
          )
          .optional(),
        currency_entries: z.array(currencyEntrySchema).max(200).optional(),
        payment_method_entries: z.array(paymentMethodEntrySchema).max(500).optional(),
        price_type_entries: z.array(priceTypeEntrySchema).max(500).optional(),
        request_type_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        refusal_reason_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        cancel_payment_reason_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        order_note_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        task_type_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        photo_category_entries: z.array(clientRefEntrySchema).max(2000).optional(),
        finance_category_entries: z.array(clientRefEntrySchema).max(2000).optional()
      })
      .optional()
  })
  .strict();

const patchBodySchema = z
  .object({
    mode: z.enum(["all", "first_only", "capped"]).optional(),
    max_units: z.number().int().min(1).nullable().optional(),
    forbid_apply_all_eligible: z.boolean().optional()
  })
  .strict();

export async function registerTenantSettingsRoutes(app: FastifyInstance) {
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
          "Request validation failed",
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
    "/api/:slug/settings/bonus-stack",
    { preHandler: [jwtAccessVerify, requireRoles(...bonusStackReadRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const json = await getTenantBonusStack(request.tenant!.id);
      return reply.send({ bonus_stack: json });
    }
  );

  app.patch(
    "/api/:slug/settings/bonus-stack",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = patchBodySchema.safeParse(request.body);
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
      const { json } = await updateTenantBonusStack(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ bonus_stack: json });
    }
  );

  const mobileAppReleasePatchSchema = z
    .object({
      min_version: z.string().max(64).nullable().optional(),
      latest_version: z.string().max(64).nullable().optional(),
      force_update: z.boolean().optional(),
      download_url: z.string().max(4000).nullable().optional(),
      store_url_android: z.string().max(4000).nullable().optional(),
      store_url_ios: z.string().max(4000).nullable().optional(),
      release_notes: z.string().max(8000).nullable().optional()
    })
    .strict();

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
