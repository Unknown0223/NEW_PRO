import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { createCashDeskUserLink } from "../cash-desks/cash-desks.service";
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import {
  parseMobileConfigV1,
  validateAgentMobileConfig,
  type AgentMobileConfigV1
} from "./agent-mobile-config";
import {
  assertValidEntitlementsKeys,
  normalizeWarehouseStaffEntitlementsRow,
  toPrismaJsonEntitlements
} from "./skladchik-entitlements";
import type { DistributionWebStaffRole } from "../../lib/tenant-user-roles";
import {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  DISTRIBUTION_WEB_STAFF_ROLES,
  OPERATOR_LIKE_WEB_ROLES,
  WEB_PANEL_STAFF_ROLES
} from "../../lib/tenant-user-roles";
export type { AgentMobileConfigV1 } from "./agent-mobile-config";

export {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  DISTRIBUTION_WEB_STAFF_ROLES,
  OPERATOR_LIKE_WEB_ROLES,
  WEB_PANEL_STAFF_ROLES
} from "../../lib/tenant-user-roles";

export type StaffKind =
  | "agent"
  | "expeditor"
  | "supervisor"
  | "collector"
  | "auditor"
  | "operator"
  | "skladchik"
  | DistributionWebStaffRole;

/** `warehouse_user_links.link_role` — skladchik omborlari */
export const SKLADCHIK_WAREHOUSE_LINK_ROLE = "skladchik";

export type AgentEntitlements = {
  price_types?: string[];
  product_rules?: Array<{ category_id: number; all: boolean; product_ids?: number[] }>;
  /** Mobil maydon savdosi siyosati (schema_version: 1). */
  mobile_config?: AgentMobileConfigV1;
};

/** Zakazni dastavchikka avtomatik bog‘lash (UI «Условия привязки»). Bo‘sh massivlar = shart qo‘llanmaydi. */
export type ExpeditorAssignmentRules = {
  price_types?: string[];
  agent_ids?: number[];
  warehouse_ids?: number[];
  trade_directions?: string[];
  territories?: string[];
  /** 1 = dushanba … 7 = yakshanba (UI visit_weekdays bilan bir xil) */
  weekdays?: number[];
};

export type StaffRow = {
  id: number;
  kind: StaffKind;
  fio: string;
  product: string | null;
  agent_type: string | null;
  code: string | null;
  pinfl: string | null;
  consignment: boolean;
  consignment_limit_amount: string | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_updated_at: string | null;
  apk_version: string | null;
  device_name: string | null;
  last_sync_at: string | null;
  phone: string | null;
  email: string | null;
  can_authorize: boolean;
  price_type: string | null;
  /** Bir nechta narx turi (ko‘rsatish) */
  price_types: string[];
  warehouse: string | null;
  trade_direction_id: number | null;
  trade_direction: string | null;
  branch: string | null;
  position: string | null;
  created_at: string;
  app_access: boolean;
  territory: string | null;
  login: string;
  is_active: boolean;
  max_sessions: number;
  active_session_count: number;
  kpi_color: string | null;
  agent_entitlements: AgentEntitlements;
  expeditor_assignment_rules: ExpeditorAssignmentRules;
  client_count: number;
  /** Agentning ustavi (User.id) */
  supervisor_user_id: number | null;
  supervisor_name: string | null;
  /** `role: supervisor` bo‘lgan foydalanuvchining ostidagi agentlar soni */
  supervisee_count: number;
  /** Supervisor ostidagi agentlar (faqat `kind === "supervisor"` da to‘ldiriladi) */
  supervisees: Array<{ id: number; fio: string; code: string | null }>;
  /** Jadval tahriri (F.I.Sh alohida maydonlar) */
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  /** `kind === "skladchik"`: biriktirilgan omborlar */
  warehouses: Array<{ id: number; name: string }>;
  /** `kind === "collector"`: biriktirilgan kassalar */
  cash_desks: Array<{ id: number; name: string }>;
  /** Skladchik «Конфигурации»; boshqa rollarda `{}` */
  warehouse_staff_entitlements: Record<string, boolean>;
  /** Faol ishchi o‘rni (agent, inkasator, ekspeditor, omborchi) */
  work_slot_id: number | null;
  work_slot_code: string | null;
};

export type StaffCreateResult = StaffRow & { warnings?: string[] };

export const STAFF_KINDS_WITH_WORK_SLOT = new Set<StaffKind>([
  "agent",
  "collector",
  "expeditor",
  "skladchik"
]);

export type CreateStaffInput = {
  first_name: string;
  last_name?: string | null;
  middle_name?: string | null;
  login: string;
  password: string;
  phone?: string | null;
  email?: string | null;
  product?: string | null;
  agent_type?: string | null;
  code?: string | null;
  pinfl?: string | null;
  consignment?: boolean;
  consignment_limit_amount?: string | null;
  consignment_ignore_previous_months_debt?: boolean;
  apk_version?: string | null;
  device_name?: string | null;
  can_authorize?: boolean;
  price_type?: string | null;
  agent_price_types?: string[];
  warehouse_id?: number | null;
  return_warehouse_id?: number | null;
  trade_direction_id?: number | null;
  trade_direction?: string | null;
  branch?: string | null;
  position?: string | null;
  app_access?: boolean;
  territory?: string | null;
  is_active?: boolean;
  max_sessions?: number;
  kpi_color?: string | null;
  agent_entitlements?: AgentEntitlements;
  /** Faqat `kind === "operator"`: yaratilganda kassaga bog‘lash */
  cash_desk_id?: number | null;
  cash_desk_link_role?: "cashier" | "manager" | "operator" | null;
  /** Faqat `kind === "skladchik"`: bir yoki bir nechta ombor */
  warehouse_ids?: number[];
  /** Skladchik ruxsatlari */
  warehouse_staff_entitlements?: Record<string, boolean>;
  /** Mavjud bo‘sh yoki almashtiriladigan WorkSlot ga biriktirish (yaratishdan keyin). */
  work_slot_id?: number | null;
};

export type ListStaffFilters = {
  branch?: string;
  trade_direction?: string;
  position?: string;
  /** To‘liq moslik (masalan «зона») */
  territory?: string;
  /** `territory` maydonida qator bo‘yicha qidiruv (область) */
  territory_oblast?: string;
  /** `territory` maydonida qator bo‘yicha qidiruv (город) */
  territory_city?: string;
  is_active?: boolean;
  /** Filtr: ushbu omborga bog‘langan skladchiklar (`warehouse_id` yoki `warehouse_user_links`) */
  warehouse_id?: number;
};
