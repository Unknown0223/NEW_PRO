import { z } from "zod";
import { clientAgentAssignmentSlotSchema } from "../../contracts/clients.schemas";

const optionalRefString = z.string().max(500).nullable().optional();
const coordIn = z.union([z.number().finite(), z.string(), z.null()]).optional();

export const createClientEquipmentBodySchema = z.object({
  inventory_type: z.string().min(1).max(256),
  equipment_kind: z.string().max(256).nullable().optional(),
  serial_number: z.string().max(128).nullable().optional(),
  inventory_number: z.string().max(128).nullable().optional(),
  note: z.string().max(2000).nullable().optional()
});

export const createClientPhotoBodySchema = z.object({
  image_url: z.string().min(1).max(4000),
  caption: z.string().max(1000).nullable().optional(),
  order_id: z.number().int().positive().nullable().optional()
});

export const createClientBodySchema = z.object({
  name: z.string().min(3).max(255),
  phone: z.string().max(80).nullable().optional(),
  category: optionalRefString,
  client_type_code: optionalRefString,
  region: optionalRefString,
  district: optionalRefString,
  city: optionalRefString,
  neighborhood: optionalRefString,
  zone: optionalRefString,
  client_format: optionalRefString,
  sales_channel: optionalRefString,
  product_category_ref: optionalRefString,
  logistics_service: optionalRefString,
  legal_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  responsible_person: z.string().nullable().optional(),
  landmark: z.string().nullable().optional(),
  inn: z.string().nullable().optional(),
  working_hours: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  client_code: z.string().nullable().optional(),
  latitude: coordIn,
  longitude: coordIn,
  is_active: z.boolean().optional(),
  agent_assignments: z.array(clientAgentAssignmentSlotSchema).max(10).optional()
});

export const mergeBodySchema = z.object({
  keep_client_id: z.number().int().positive(),
  merge_client_ids: z.array(z.number().int().positive()).min(1)
});

export const savedDupGroupBodySchema = z.object({
  master_client_id: z.number().int().positive(),
  client_ids: z.array(z.number().int().positive()).min(2),
  note: z.string().max(2000).optional().nullable()
});

export const balanceMovementBodySchema = z.object({
  delta: z.number().finite(),
  note: z.string().max(500).nullable().optional()
});

export const bulkActiveBodySchema = z.object({
  client_ids: z.array(z.number().int().positive()).min(1).max(500),
  is_active: z.boolean()
});
