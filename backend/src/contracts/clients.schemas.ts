import { z } from "zod";

/** PATCH `/api/:slug/clients/:id` — agent slotlari */
export const clientAgentAssignmentSlotSchema = z.object({
  slot: z.number().int().min(1).max(10),
  agent_id: z.number().int().positive().nullable().optional(),
  visit_date: z.string().nullable().optional(),
  expeditor_phone: z.string().nullable().optional(),
  expeditor_user_id: z.number().int().positive().nullable().optional(),
  visit_weekdays: z.array(z.number().int().min(1).max(7)).max(7).optional()
});

/** PATCH `/api/:slug/clients/:id` — kontakt slotlari */
export const clientContactSlotSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional()
});

const clientCoordInput = z.union([z.number().finite(), z.string(), z.null()]).optional();

/** PATCH `/api/:slug/clients/:id` tanasi — kamida bitta maydon */
export const patchClientBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    legal_name: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    credit_limit: z.number().nonnegative().optional(),
    address: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    client_type_code: z.string().nullable().optional(),
    responsible_person: z.string().nullable().optional(),
    landmark: z.string().nullable().optional(),
    inn: z.string().nullable().optional(),
    pdl: z.string().nullable().optional(),
    logistics_service: z.string().nullable().optional(),
    license_until: z.string().nullable().optional(),
    working_hours: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    house_number: z.string().nullable().optional(),
    apartment: z.string().nullable().optional(),
    gps_text: z.string().nullable().optional(),
    visit_date: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    client_format: z.string().nullable().optional(),
    client_code: z.string().nullable().optional(),
    sales_channel: z.string().nullable().optional(),
    product_category_ref: z.string().nullable().optional(),
    bank_name: z.string().nullable().optional(),
    bank_account: z.string().nullable().optional(),
    bank_mfo: z.string().nullable().optional(),
    client_pinfl: z.string().nullable().optional(),
    oked: z.string().nullable().optional(),
    contract_number: z.string().nullable().optional(),
    vat_reg_code: z.string().nullable().optional(),
    latitude: clientCoordInput,
    longitude: clientCoordInput,
    zone: z.string().nullable().optional(),
    agent_id: z.number().int().positive().nullable().optional(),
    agent_assignments: z.array(clientAgentAssignmentSlotSchema).max(10).optional(),
    contact_persons: z.array(clientContactSlotSchema).max(10).optional(),
    is_active: z.boolean().optional()
  })
  .refine((o) => Object.keys(o).length > 0, { message: "empty" });

export type PatchClientBody = z.infer<typeof patchClientBodySchema>;
