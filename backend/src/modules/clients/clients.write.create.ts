import { prisma } from "../../config/database";
import { isValidPhoneNumber, normalizePhoneNumber } from "../../domain/phone-number";
import { tenantIdFrom } from "../../domain/tenant-id";
import { applyTerritoryAutoAssignAfterAddressChange } from "../work-slots/work-slots.territory-auto";
import { appendClientAuditLog } from "./clients.audit";
import { applyTerritoryHintsToClientInput } from "./clients.territory-sync";
import type { CreateClientMinimalInput } from "./clients.write.types";
import { throwIfClientUniqueConflicts } from "./clients.write.uniques";

export async function createClientMinimal(
  tenantIdRaw: number,
  actorUserId: number | null,
  input: CreateClientMinimalInput
): Promise<{ id: number }> {
  const tenantId = tenantIdFrom(tenantIdRaw);
  const name = input.name?.trim();
  if (!name) {
    throw new Error("VALIDATION");
  }
  let phone: string | null = null;
  let phoneNormalized: string | null = null;
  if (input.phone != null && String(input.phone).trim() !== "") {
    const rawPhone = String(input.phone).trim();
    if (!isValidPhoneNumber(rawPhone)) {
      throw new Error("VALIDATION");
    }
    phone = rawPhone;
    phoneNormalized = normalizePhoneNumber(rawPhone);
  }

  const str = (v: string | null | undefined) => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === "" ? null : t;
  };

  const hinted = await applyTerritoryHintsToClientInput(tenantId, {
    city: str(input.city),
    region: str(input.region),
    zone: str(input.zone)
  });
  const region = hinted.region;
  const zone = hinted.zone;
  const city = hinted.city;

  await throwIfClientUniqueConflicts(tenantId, {
    name,
    phone,
    phone_normalized: phoneNormalized,
    inn: input.inn,
    client_code: input.client_code,
    client_pinfl: input.client_pinfl,
    region,
    zone,
    city
  });

  const row = await prisma.client.create({
    data: {
      tenant_id: tenantId,
      name,
      phone,
      phone_normalized: phoneNormalized,
      category: str(input.category),
      client_type_code: str(input.client_type_code),
      region,
      district: str(input.district),
      city,
      neighborhood: str(input.neighborhood),
      zone,
      client_format: str(input.client_format),
      sales_channel: str(input.sales_channel),
      product_category_ref: str(input.product_category_ref),
      logistics_service: str(input.logistics_service),
      ...(input.is_active === true || input.is_active === false ? { is_active: input.is_active } : {})
    }
  });

  const detail: Record<string, unknown> = { name, phone };
  for (const [k, v] of Object.entries({
    category: str(input.category),
    client_type_code: str(input.client_type_code),
    region,
    district: str(input.district),
    city,
    neighborhood: str(input.neighborhood),
    zone,
    client_format: str(input.client_format),
    sales_channel: str(input.sales_channel),
    product_category_ref: str(input.product_category_ref),
    logistics_service: str(input.logistics_service)
  })) {
    if (v != null) detail[k] = v;
  }

  await appendClientAuditLog(tenantId, row.id, actorUserId, "client.create", detail);

  const hasAddress =
    region != null || city != null || str(input.district) != null || zone != null;
  if (hasAddress && !input.skipTerritoryAutoAssign) {
    await applyTerritoryAutoAssignAfterAddressChange(tenantId, row.id);
  }

  return { id: row.id };
}

