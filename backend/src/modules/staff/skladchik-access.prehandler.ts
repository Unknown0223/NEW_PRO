import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  sanitizeWarehouseStaffEntitlements,
  SKLADCHIK_ENTITLEMENT_KEYS,
  type SkladchikEntitlementKey
} from "./skladchik-entitlements";

async function loadSkladchikEntitlementsJson(
  tenantId: number,
  userId: number
): Promise<Record<string, boolean> | null> {
  const row = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, role: "skladchik", is_active: true },
    select: { warehouse_staff_entitlements: true }
  });
  if (!row) return null;
  return sanitizeWarehouseStaffEntitlements(
    row.warehouse_staff_entitlements as Record<string, boolean> | null
  );
}

/**
 * Rol `allowedRoles` ichida bo‘lsa — o‘tadi.
 * Aks holda faqat `skladchik` va berilgan entitlement `true` bo‘lsa — o‘tadi.
 */
export function requireRolesOrSkladchikEntitlement(
  allowedRoles: readonly string[],
  entitlement: SkladchikEntitlementKey
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const u = getAccessUser(request);
    if (allowedRoles.includes(u.role)) return;
    if (u.role !== "skladchik") {
      void sendApiError(reply, request, 403, "ForbiddenRole");
      return;
    }
    const tid = request.tenant?.id;
    if (tid == null) {
      void sendApiError(reply, request, 500, "TenantMissing");
      return;
    }
    const uid = Number.parseInt(u.sub, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      void sendApiError(reply, request, 403, "ForbiddenRole");
      return;
    }
    const ent = await loadSkladchikEntitlementsJson(tid, uid);
    if (!ent || ent[entitlement] !== true) {
      void sendApiError(reply, request, 403, "ForbiddenEntitlement", undefined, { entitlement });
      return;
    }
  };
}

/** `allowedRoles` dan biri yoki skladchik + `anyOf` dan kamida bittasi `true`. */
export function requireRolesOrSkladchikAnyEntitlement(
  allowedRoles: readonly string[],
  anyOf: readonly SkladchikEntitlementKey[]
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const u = getAccessUser(request);
    if (allowedRoles.includes(u.role)) return;
    if (u.role !== "skladchik") {
      void sendApiError(reply, request, 403, "ForbiddenRole");
      return;
    }
    const tid = request.tenant?.id;
    if (tid == null) {
      void sendApiError(reply, request, 500, "TenantMissing");
      return;
    }
    const uid = Number.parseInt(u.sub, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      void sendApiError(reply, request, 403, "ForbiddenRole");
      return;
    }
    const ent = await loadSkladchikEntitlementsJson(tid, uid);
    if (!ent) {
      void sendApiError(reply, request, 403, "ForbiddenEntitlement");
      return;
    }
    const ok = anyOf.some((k) => ent[k] === true);
    if (!ok) {
      void sendApiError(reply, request, 403, "ForbiddenEntitlement", undefined, {
        anyOf: [...anyOf]
      });
      return;
    }
  };
}

/**
 * Boshqa rollar uchun cheklov qo‘ymaydi; faqat `skladchik` bo‘lsa entitlement tekshiriladi.
 * (Masalan: GET /products — agentlar uchun ochiq, skladchik uchun kamida bitta ombor-ruxsat.)
 */
export function requireIfSkladchikThenAnyEntitlement(anyOf: readonly SkladchikEntitlementKey[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const u = getAccessUser(request);
    if (u.role !== "skladchik") return;
    const tid = request.tenant?.id;
    if (tid == null) {
      void sendApiError(reply, request, 500, "TenantMissing");
      return;
    }
    const uid = Number.parseInt(u.sub, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      void sendApiError(reply, request, 403, "ForbiddenRole");
      return;
    }
    const ent = await loadSkladchikEntitlementsJson(tid, uid);
    if (!ent) {
      void sendApiError(reply, request, 403, "ForbiddenEntitlement");
      return;
    }
    const ok = anyOf.some((k) => ent[k] === true);
    if (!ok) {
      void sendApiError(reply, request, 403, "ForbiddenEntitlement", undefined, {
        anyOf: [...anyOf]
      });
      return;
    }
  };
}

/** Buyurtma / ombor-yuklash UI uchun skladchik «kirish» to‘plami. */
export const SKLADCHIK_ORDER_FLOW_ANY: SkladchikEntitlementKey[] = [
  "shipping_list",
  "shipping_detail",
  "shipping_confirm",
  "shipping_excel",
  "shipping_create",
  "assembly_list",
  "assembly_detail",
  "assembly_create",
  "assembly_collect",
  "assembly_verify",
  "return_invoice_list",
  "return_invoice_detail",
  "return_invoice_confirm"
];

/** Zakaz meta (ombor, blok, ekspeditor) — skladchik uchun. */
export const SKLADCHIK_ORDER_META_ANY: SkladchikEntitlementKey[] = [
  "shipping_detail",
  "shipping_confirm",
  "assembly_detail",
  "assembly_collect",
  "return_invoice_detail",
  "warehouse_block_list",
  "warehouse_block_confirm_empty"
];

export const SKLADCHIK_ALL_ENTITLEMENT_KEYS: readonly SkladchikEntitlementKey[] = SKLADCHIK_ENTITLEMENT_KEYS;
