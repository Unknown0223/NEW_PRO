import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { isValidPhoneNumber, normalizePhoneNumber } from "../../domain/phone-number";
import { tenantIdFrom } from "../../domain/tenant-id";
import {
  applyTerritoryAutoAssignAfterAddressChange,
  clientUpdateTouchesAddress
} from "../work-slots/work-slots.territory-auto";
import type { AgentAssignmentPatch, ContactPersonSlot } from "./clients.types";
import { normalizePhoneDigits } from "./clients.types";
import { CONTACT_SLOTS, contactPersonsToJson } from "./clients.helpers";
import {
  replaceClientAgentAssignments,
  syncAssignmentSlotOneWithClientRow
} from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import type { ClientDetailRow } from "./clients.detail";
import { getClientDetail } from "./clients.detail";

import type { CreateClientMinimalInput } from "./clients.write.types";
import { parseOptionalLatitude, parseOptionalLongitude } from "./clients.write.helpers";

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

  const duplicateWhere: Prisma.ClientWhereInput[] = [
    {
      tenant_id: tenantId,
      merged_into_client_id: null,
      name: { equals: name, mode: "insensitive" }
    }
  ];
  if (phoneNormalized) {
    duplicateWhere.push({
      tenant_id: tenantId,
      merged_into_client_id: null,
      phone_normalized: phoneNormalized
    });
  }
  const duplicate = await prisma.client.findFirst({
    where: { OR: duplicateWhere },
    select: { id: true, name: true, phone: true }
  });
  if (duplicate) {
    if (phoneNormalized && duplicate.phone && normalizePhoneNumber(duplicate.phone) === phoneNormalized) {
      throw new Error("DUPLICATE_PHONE");
    }
    throw new Error("DUPLICATE_NAME");
  }

  const str = (v: string | null | undefined) => {
    if (v == null) return null;
    const t = String(v).trim();
    return t === "" ? null : t;
  };

  const row = await prisma.client.create({
    data: {
      tenant_id: tenantId,
      name,
      phone,
      phone_normalized: phoneNormalized,
      category: str(input.category),
      client_type_code: str(input.client_type_code),
      region: str(input.region),
      district: str(input.district),
      city: str(input.city),
      neighborhood: str(input.neighborhood),
      zone: str(input.zone),
      client_format: str(input.client_format),
      sales_channel: str(input.sales_channel),
      product_category_ref: str(input.product_category_ref),
      logistics_service: str(input.logistics_service)
    }
  });

  const detail: Record<string, unknown> = { name, phone };
  for (const [k, v] of Object.entries({
    category: str(input.category),
    client_type_code: str(input.client_type_code),
    region: str(input.region),
    district: str(input.district),
    city: str(input.city),
    neighborhood: str(input.neighborhood),
    zone: str(input.zone),
    client_format: str(input.client_format),
    sales_channel: str(input.sales_channel),
    product_category_ref: str(input.product_category_ref),
    logistics_service: str(input.logistics_service)
  })) {
    if (v != null) detail[k] = v;
  }

  await appendClientAuditLog(tenantId, row.id, actorUserId, "client.create", detail);

  const hasAddress =
    str(input.region) != null ||
    str(input.city) != null ||
    str(input.district) != null ||
    str(input.zone) != null;
  if (hasAddress) {
    await applyTerritoryAutoAssignAfterAddressChange(tenantId, row.id);
  }

  return { id: row.id };
}

