import { z } from "zod";
import { WORK_SLOT_TYPES } from "./work-slots.constants";

export const slotTypeSchema = z.enum(WORK_SLOT_TYPES);

export const createWorkSlotBodySchema = z.object({
  slot_code: z.string().trim().min(1).max(32),
  label: z.string().trim().max(128).nullable().optional(),
  branch_code: z.string().trim().max(120).nullable().optional(),
  direction_id: z.number().int().positive().nullable().optional(),
  slot_type: slotTypeSchema.default("agent"),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional()
});

/** Faol xodim (`User`) — zona / ombor / kassa (jadvalda ko‘rinadigan ustunlar). */
export const activeUserAttrsSchema = z.object({
  territory_zone: z.string().trim().max(128).nullable().optional(),
  territory_oblast: z.string().trim().max(128).nullable().optional(),
  territory_city: z.string().trim().max(128).nullable().optional(),
  warehouse_id: z.number().int().positive().nullable().optional(),
  cash_desk_id: z.number().int().positive().nullable().optional()
});

/** Q-01: slot kodi yaratilgandan keyin o‘zgarmaydi — faqat label/filial/tur va h.k. */
export const patchWorkSlotBodySchema = z
  .object({
    label: z.string().trim().max(128).nullable().optional(),
    branch_code: z.string().trim().max(120).nullable().optional(),
    direction_id: z.number().int().positive().nullable().optional(),
    slot_type: slotTypeSchema.optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional()
  })
  .merge(activeUserAttrsSchema)
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
    o.warehouse_id !== undefined ||
    o.cash_desk_id !== undefined
  );
}

const territoryCodesListSchema = z.array(z.string().trim().min(1).max(128)).min(1);

export const bulkWorkSlotsBodySchema = z
  .object({
    slot_ids: z.array(z.number().int().positive()).min(1).max(500),
    delete: z.literal(true).optional(),
    is_active: z.boolean().optional(),
    branch_code: z.string().trim().max(120).nullable().optional(),
    branch_codes: z.array(z.string().trim().min(1).max(120)).min(1).optional(),
    slot_type: slotTypeSchema.optional(),
    territory_zones: territoryCodesListSchema.optional(),
    territory_oblasts: territoryCodesListSchema.optional(),
    territory_cities: territoryCodesListSchema.optional()
  })
  .merge(activeUserAttrsSchema)
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
  .refine(
    (o) =>
      o.delete === true ||
      o.is_active !== undefined ||
      o.branch_code !== undefined ||
      o.branch_codes !== undefined ||
      o.slot_type !== undefined ||
      hasActiveUserAttrs(o) ||
      o.territory_zones !== undefined ||
      o.territory_oblasts !== undefined ||
      o.territory_cities !== undefined,
    { message: "EmptyPatch" }
  );
