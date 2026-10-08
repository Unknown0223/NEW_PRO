import { z } from "zod";
import { maxSessionsValueSchema } from "../../lib/max-sessions";
import { WORK_SLOT_TYPES } from "./work-slots.constants";

export const slotTypeSchema = z.enum(WORK_SLOT_TYPES);

const branchCodesListSchema = z.array(z.string().trim().min(1).max(120)).max(50);

export const createWorkSlotBodySchema = z.object({
  slot_code: z.string().trim().min(1).max(32),
  label: z.string().trim().max(128).nullable().optional(),
  branch_code: z.string().trim().max(120).nullable().optional(),
  branch_codes: branchCodesListSchema.optional(),
  direction_id: z.number().int().positive().nullable().optional(),
  slot_type: slotTypeSchema.default("agent"),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

const positiveIdListSchema = z.array(z.number().int().positive()).max(100);
const territoryListSchema = z.array(z.string().trim().min(1).max(256)).max(200);

/** Faol xodim (`User`) — zona / ombor / kassa + shaxsiy maydonlar (write-through userga). */
export const activeUserAttrsSchema = z.object({
  territory_zone: z.string().trim().max(128).nullable().optional(),
  territory_oblast: z.string().trim().max(128).nullable().optional(),
  territory_city: z.string().trim().max(128).nullable().optional(),
  territories: territoryListSchema.nullable().optional(),
  warehouse_id: z.number().int().positive().nullable().optional(),
  warehouse_ids: positiveIdListSchema.nullable().optional(),
  cash_desk_id: z.number().int().positive().nullable().optional(),
  cash_desk_ids: positiveIdListSchema.nullable().optional(),
  /** Occupant-only: User.position (WorkSlot da saqlanmaydi). */
  position: z.string().trim().max(120).nullable().optional(),
  /** Occupant-only: User.app_access */
  app_access: z.boolean().optional(),
  /** Occupant-only: User.max_sessions (0 = cheksiz) */
  max_sessions: maxSessionsValueSchema.optional()
});

export const maxSessionsBySlotTypeBodySchema = z.object({
  slot_type: slotTypeSchema,
  max_sessions: maxSessionsValueSchema
});

export const revokeWorkSlotSessionsBody = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ token_ids: z.array(z.number().int().positive()).min(1) })
]);

/** Joy konfiguratsiyasi (P0): narx, cheklov, konsignatsiya — manba slotda. */
export const slotConfigPatchSchema = z.object({
  return_warehouse_id: z.number().int().positive().nullable().optional(),
  price_type: z.string().trim().max(64).nullable().optional(),
  price_types: z.array(z.string()).optional(),
  entitlements: z.record(z.string(), z.unknown()).optional(),
  consignment: z.boolean().optional(),
  consignment_limit_amount: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }),
  consignment_ignore_previous_months_debt: z.boolean().optional(),
  consignment_close_day: z.number().int().min(1).max(31).optional(),
  consignment_close_hour: z.number().int().min(0).max(23).optional(),
  consignment_close_minute: z.number().int().min(0).max(59).optional(),
  supervisor_user_id: z.number().int().positive().nullable().optional(),
  supervisee_agent_slot_ids: z.array(z.number().int().positive()).optional(),
  warehouse_staff_entitlements: z.record(z.string(), z.boolean()).optional(),
  expeditor_assignment_rules: z.record(z.string(), z.unknown()).optional()
});

const territoryCodesListSchema = z.array(z.string().trim().min(1).max(128)).min(1);

export const patchWorkSlotBodySchema = z
  .object({
    label: z.string().trim().max(128).nullable().optional(),
    branch_code: z.string().trim().max(120).nullable().optional(),
    branch_codes: branchCodesListSchema.optional(),
    direction_id: z.number().int().positive().nullable().optional(),
    slot_type: slotTypeSchema.optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    territory_zones: territoryCodesListSchema.optional(),
    territory_oblasts: territoryCodesListSchema.optional(),
    territory_cities: territoryCodesListSchema.optional()
  })
  .merge(activeUserAttrsSchema)
  .merge(slotConfigPatchSchema)
  .strict();

export const assignUserBodySchema = z.object({
  user_id: z.number().int().positive(),
  note: z.string().trim().max(500).nullable().optional()
});

export const patchLockBodySchema = z.object({
  lock_type: z.enum(["none", "manual", "contract"]),
  lock_reason: z.string().trim().max(500).nullable().optional()
});

export const resolvePendingBodySchema = z.object({
  agent_id: z.number().int().positive().nullable(),
  lock_after: z.boolean().optional()
});

function hasActiveUserAttrs(o: z.infer<typeof activeUserAttrsSchema>): boolean {
  return (
    o.territory_zone !== undefined ||
    o.territory_oblast !== undefined ||
    o.territory_city !== undefined ||
    o.territories !== undefined ||
    o.warehouse_id !== undefined ||
    o.warehouse_ids !== undefined ||
    o.cash_desk_id !== undefined ||
    o.cash_desk_ids !== undefined ||
    o.position !== undefined ||
    o.app_access !== undefined ||
    o.max_sessions !== undefined
  );
}

function hasSlotConfigFields(o: z.infer<typeof slotConfigPatchSchema>): boolean {
  return (
    o.return_warehouse_id !== undefined ||
    o.price_type !== undefined ||
    o.price_types !== undefined ||
    o.entitlements !== undefined ||
    o.consignment !== undefined ||
    o.consignment_limit_amount !== undefined ||
    o.consignment_ignore_previous_months_debt !== undefined ||
    o.consignment_close_day !== undefined ||
    o.consignment_close_hour !== undefined ||
    o.consignment_close_minute !== undefined ||
    o.supervisor_user_id !== undefined ||
    o.supervisee_agent_slot_ids !== undefined ||
    o.warehouse_staff_entitlements !== undefined ||
    o.expeditor_assignment_rules !== undefined
  );
}

export const bulkWorkSlotsBodySchema = z
  .object({
    slot_ids: z.array(z.number().int().positive()).min(1).max(500),
    /** replace — mobile_config butunlay almashtiriladi; merge — faqat yuborilgan kalitlar. */
    mobile_config_mode: z.enum(["merge", "replace"]).optional(),
    delete: z.literal(true).optional(),
    unassign: z.literal(true).optional(),
    revoke_sessions: z.literal(true).optional(),
    is_active: z.boolean().optional(),
    label: z.string().trim().max(128).nullable().optional(),
    branch_code: z.string().trim().max(120).nullable().optional(),
    branch_codes: branchCodesListSchema.min(1).optional(),
    direction_id: z.number().int().positive().nullable().optional(),
    slot_type: slotTypeSchema.optional(),
    territory_zones: territoryCodesListSchema.optional(),
    territory_oblasts: territoryCodesListSchema.optional(),
    territory_cities: territoryCodesListSchema.optional()
  })
  .merge(activeUserAttrsSchema)
  .merge(slotConfigPatchSchema)
  .strict()
  .refine((o) => !(o.branch_code !== undefined && o.branch_codes !== undefined), {
    message: "BranchAmbiguous"
  })
  .refine((o) => !(o.territory_zone !== undefined && o.territory_zones !== undefined), {
    message: "TerritoryZoneAmbiguous"
  })
  .refine((o) => !(o.territory_oblast !== undefined && o.territory_oblasts !== undefined), {
    message: "TerritoryOblastAmbiguous"
  })
  .refine((o) => !(o.territory_city !== undefined && o.territory_cities !== undefined), {
    message: "TerritoryCityAmbiguous"
  })
  .refine((o) => !(o.delete === true && o.unassign === true), { message: "DeleteUnassignAmbiguous" })
  .refine(
    (o) =>
      !(
        o.revoke_sessions === true &&
        (o.delete === true || o.unassign === true)
      ),
    { message: "RevokeSessionsAmbiguous" }
  )
  .refine(
    (o) =>
      o.delete === true ||
      o.unassign === true ||
      o.revoke_sessions === true ||
      o.is_active !== undefined ||
      o.label !== undefined ||
      o.branch_code !== undefined ||
      o.branch_codes !== undefined ||
      o.direction_id !== undefined ||
      o.slot_type !== undefined ||
      hasActiveUserAttrs(o) ||
      hasSlotConfigFields(o) ||
      o.territory_zones !== undefined ||
      o.territory_oblasts !== undefined ||
      o.territory_cities !== undefined,
    { message: "EmptyPatch" }
  );
