import { z } from "zod";
import { maxSessionsValueSchema } from "../../lib/max-sessions";
import type { ListStaffFilters } from "./staff.service";
export function parseAgentListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters: ListStaffFilters = {};
  if (q.is_active === "true") filters.is_active = true;
  else if (q.is_active === "false") filters.is_active = false;
  if (q.branch?.trim()) filters.branch = q.branch.trim();
  if (q.trade_direction?.trim()) filters.trade_direction = q.trade_direction.trim();
  if (q.position?.trim()) filters.position = q.position.trim();
  if (q.territory?.trim()) filters.territory = q.territory.trim();
  if (q.territory_oblast?.trim()) filters.territory_oblast = q.territory_oblast.trim();
  if (q.territory_city?.trim()) filters.territory_city = q.territory_city.trim();
  return filters;
}

export function parseExpeditorListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters = parseAgentListFilters(q);
  if (q.territory?.trim()) filters.territory = q.territory.trim();
  if (q.territory_oblast?.trim()) filters.territory_oblast = q.territory_oblast.trim();
  if (q.territory_city?.trim()) filters.territory_city = q.territory_city.trim();
  return filters;
}

export function parseSupervisorListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters: ListStaffFilters = {};
  if (q.is_active === "true") filters.is_active = true;
  else if (q.is_active === "false") filters.is_active = false;
  if (q.position?.trim()) filters.position = q.position.trim();
  return filters;
}

export function parseCollectorListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters: ListStaffFilters = {};
  if (q.is_active === "true") filters.is_active = true;
  else if (q.is_active === "false") filters.is_active = false;
  if (q.position?.trim()) filters.position = q.position.trim();
  if (q.territory?.trim()) filters.territory = q.territory.trim();
  if (q.territory_oblast?.trim()) filters.territory_oblast = q.territory_oblast.trim();
  if (q.territory_city?.trim()) filters.territory_city = q.territory_city.trim();
  return filters;
}

export function parseAuditorListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters: ListStaffFilters = {};
  if (q.is_active === "true") filters.is_active = true;
  else if (q.is_active === "false") filters.is_active = false;
  if (q.position?.trim()) filters.position = q.position.trim();
  if (q.territory?.trim()) filters.territory = q.territory.trim();
  if (q.territory_oblast?.trim()) filters.territory_oblast = q.territory_oblast.trim();
  if (q.territory_city?.trim()) filters.territory_city = q.territory_city.trim();
  return filters;
}

export function parseOperatorListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters: ListStaffFilters = {};
  if (q.is_active === "true") filters.is_active = true;
  else if (q.is_active === "false") filters.is_active = false;
  if (q.branch?.trim()) filters.branch = q.branch.trim();
  if (q.position?.trim()) filters.position = q.position.trim();
  return filters;
}

export function parseSkladchikListFilters(q: Record<string, string | undefined>): ListStaffFilters {
  const filters = parseOperatorListFilters(q);
  const w = q.warehouse_id?.trim();
  if (w) {
    const n = Number.parseInt(w, 10);
    if (!Number.isNaN(n) && n > 0) filters.warehouse_id = n;
  }
  return filters;
}

export const operatorLikeRoleEnum = z.enum([
  "operator",
  "director",
  "sales_director",
  "manager",
  "regional_manager",
  "accountant",
  "warehouse_manager"
]);

export const createOperatorBodySchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().nullable().optional(),
    middle_name: z.string().nullable().optional(),
    login: z.string().min(1),
    password: z.string().min(6),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    code: z.string().max(24).nullable().optional(),
    pinfl: z.string().max(24).nullable().optional(),
    branch: z.string().max(128).nullable().optional(),
    position: z.string().max(128).nullable().optional(),
    can_authorize: z.boolean().optional(),
    is_active: z.boolean().optional(),
    app_access: z.boolean().optional(),
    max_sessions: maxSessionsValueSchema.optional(),
    cash_desk_id: z.number().int().positive().optional(),
    cash_desk_link_role: z.enum(["cashier", "manager", "operator"]).optional(),
    /** `operator` dan tashqari distribusiya rollari — kassa bog‘lanmasi bo‘lmasligi kerak. */
    web_access_role: operatorLikeRoleEnum.optional()
  })
  .refine(
    (o) =>
      (o.cash_desk_id == null && o.cash_desk_link_role == null) ||
      (o.cash_desk_id != null && o.cash_desk_link_role != null),
    { message: "cash_desk_pair", path: ["cash_desk_id"] }
  )
  .refine(
    (o) =>
      (o.web_access_role ?? "operator") === "operator" ||
      (o.cash_desk_id == null && o.cash_desk_link_role == null),
    { message: "cash_desk_operator_only", path: ["cash_desk_id"] }
  );

export const patchOperatorBody = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().nullable().optional(),
    middle_name: z.string().nullable().optional(),
    login: z.string().min(1).max(64).optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    code: z.string().max(24).nullable().optional(),
    pinfl: z.string().max(24).nullable().optional(),
    branch: z.string().max(128).nullable().optional(),
    position: z.string().max(128).nullable().optional(),
    can_authorize: z.boolean().optional(),
    is_active: z.boolean().optional(),
    app_access: z.boolean().optional(),
    max_sessions: maxSessionsValueSchema.optional(),
    password: z.string().min(6).optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const createSkladchikBodySchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().nullable().optional(),
  middle_name: z.string().nullable().optional(),
  login: z.string().min(1),
  password: z.string().min(6),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  code: z.string().max(24).nullable().optional(),
  pinfl: z.string().max(24).nullable().optional(),
  branch: z.string().max(128).nullable().optional(),
  position: z.string().max(128).nullable().optional(),
  can_authorize: z.boolean().optional(),
  is_active: z.boolean().optional(),
  app_access: z.boolean().optional(),
  max_sessions: maxSessionsValueSchema.optional(),
  warehouse_ids: z.array(z.number().int().positive()).optional(),
  warehouse_staff_entitlements: z.record(z.string(), z.boolean()).optional()
});

export const patchSkladchikBody = z
  .object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().nullable().optional(),
    middle_name: z.string().nullable().optional(),
    login: z.string().min(1).max(64).optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    code: z.string().max(24).nullable().optional(),
    pinfl: z.string().max(24).nullable().optional(),
    branch: z.string().max(128).nullable().optional(),
    position: z.string().max(128).nullable().optional(),
    can_authorize: z.boolean().optional(),
    is_active: z.boolean().optional(),
    app_access: z.boolean().optional(),
    max_sessions: maxSessionsValueSchema.optional(),
    password: z.string().min(6).optional(),
    warehouse_ids: z.array(z.number().int().positive()).optional(),
    warehouse_staff_entitlements: z.record(z.string(), z.boolean()).optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export const bulkWebPanelRevokeBody = z.object({
  user_ids: z.array(z.number().int().positive()).min(1).max(200)
});

const bulkKomandaUserIds = z.array(z.number().int().positive()).min(1).max(500);

export const bulkKomandaStaffBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("set_app_access"),
    user_ids: bulkKomandaUserIds,
    app_access: z.boolean()
  }),
  z.object({
    action: z.literal("set_is_active"),
    user_ids: bulkKomandaUserIds,
    is_active: z.boolean()
  }),
  z.object({
    action: z.literal("revoke_sessions"),
    user_ids: bulkKomandaUserIds
  })
]);

export const bulkWebPanelMaxSessionsBody = z.object({
  updates: z
    .array(
      z.object({
        user_id: z.number().int().positive(),
        max_sessions: maxSessionsValueSchema
      })
    )
    .min(1)
    .max(200)
});

export const createWebStaffPositionPresetBody = z.object({
  label: z.string().min(1).max(128),
  role: z.string().min(1).max(64).nullable().optional(),
  code: z.string().max(20).nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).max(99999).nullable().optional(),
  is_active: z.boolean().optional()
});

export const patchWebStaffPositionPresetBody = z
  .object({
    label: z.string().min(1).max(128).optional(),
    role: z.string().min(1).max(64).nullable().optional(),
    code: z.string().max(20).nullable().optional(),
    comment: z.string().max(500).nullable().optional(),
    sort_order: z.number().int().min(0).max(99999).nullable().optional(),
    is_active: z.boolean().optional()
  })
  .refine(
    (o) =>
      o.label !== undefined ||
      o.role !== undefined ||
      o.code !== undefined ||
      o.comment !== undefined ||
      o.sort_order !== undefined ||
      o.is_active !== undefined,
    { message: "empty" }
  );