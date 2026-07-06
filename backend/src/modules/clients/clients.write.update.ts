import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
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
import type { UpdateClientInput } from "./clients.write.types";
import {
  normalizeClientPinfl,
  parseOptionalLatitude,
  parseOptionalLongitude
} from "./clients.write.helpers";

export async function updateClientFields(
  tenantId: number,
  id: number,
  input: UpdateClientInput,
  actorUserId?: number | null
): Promise<ClientDetailRow> {
  const existing = await prisma.client.findFirst({
    where: { id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const skipLegacyAgentFields = input.agent_assignments !== undefined;

  const data: Prisma.ClientUncheckedUpdateInput = {};
  if (input.credit_limit !== undefined) {
    if (!Number.isFinite(input.credit_limit) || input.credit_limit < 0) {
      throw new Error("VALIDATION");
    }
    data.credit_limit = new Prisma.Decimal(input.credit_limit);
  }
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (n.length < 1) throw new Error("VALIDATION");
    data.name = n;
  }
  if (input.legal_name !== undefined) {
    data.legal_name = input.legal_name?.trim() || null;
  }
  if (input.phone !== undefined) {
    const p = input.phone?.trim() || null;
    data.phone = p;
    data.phone_normalized = normalizePhoneDigits(p);
  }
  if (input.address !== undefined) {
    data.address = input.address?.trim() || null;
  }
  if (input.category !== undefined) {
    data.category = input.category?.trim() || null;
  }
  if (input.client_type_code !== undefined) {
    data.client_type_code = input.client_type_code?.trim() || null;
  }
  if (input.responsible_person !== undefined) {
    data.responsible_person = input.responsible_person?.trim() || null;
  }
  if (input.landmark !== undefined) {
    data.landmark = input.landmark?.trim() || null;
  }
  if (input.inn !== undefined) {
    data.inn = input.inn?.trim() || null;
  }
  if (input.pdl !== undefined) {
    data.pdl = input.pdl?.trim() || null;
  }
  if (input.logistics_service !== undefined) {
    data.logistics_service = input.logistics_service?.trim() || null;
  }
  if (input.working_hours !== undefined) {
    data.working_hours = input.working_hours?.trim() || null;
  }
  if (input.region !== undefined) {
    data.region = input.region?.trim() || null;
  }
  if (input.district !== undefined) {
    data.district = input.district?.trim() || null;
  }
  if (input.city !== undefined) {
    data.city = input.city?.trim() || null;
  }
  if (input.neighborhood !== undefined) {
    data.neighborhood = input.neighborhood?.trim() || null;
  }
  if (input.street !== undefined) {
    data.street = input.street?.trim() || null;
  }
  if (input.house_number !== undefined) {
    data.house_number = input.house_number?.trim() || null;
  }
  if (input.apartment !== undefined) {
    data.apartment = input.apartment?.trim() || null;
  }
  if (input.gps_text !== undefined) {
    data.gps_text = input.gps_text?.trim() || null;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes?.trim() || null;
  }
  if (input.client_format !== undefined) {
    data.client_format = input.client_format?.trim() || null;
  }
  if (input.client_code !== undefined) {
    const cc = input.client_code?.trim().slice(0, 32) || null;
    data.client_code = cc;
  }
  if (input.sales_channel !== undefined) {
    data.sales_channel = input.sales_channel?.trim() || null;
  }
  if (input.product_category_ref !== undefined) {
    data.product_category_ref = input.product_category_ref?.trim() || null;
  }
  if (input.bank_name !== undefined) {
    data.bank_name = input.bank_name?.trim() || null;
  }
  if (input.bank_account !== undefined) {
    data.bank_account = input.bank_account?.trim() || null;
  }
  if (input.bank_mfo !== undefined) {
    data.bank_mfo = input.bank_mfo?.trim() || null;
  }
  if (input.client_pinfl !== undefined) {
    data.client_pinfl = normalizeClientPinfl(input.client_pinfl);
  }
  if (input.oked !== undefined) {
    data.oked = input.oked?.trim() || null;
  }
  if (input.contract_number !== undefined) {
    data.contract_number = input.contract_number?.trim() || null;
  }
  if (input.vat_reg_code !== undefined) {
    data.vat_reg_code = input.vat_reg_code?.trim() || null;
  }
  if (input.latitude !== undefined) {
    data.latitude = parseOptionalLatitude(input.latitude);
  }
  if (input.longitude !== undefined) {
    data.longitude = parseOptionalLongitude(input.longitude);
  }
  if (input.zone !== undefined) {
    data.zone = input.zone?.trim() || null;
  }
  if (input.warehouse_id !== undefined) {
    if (input.warehouse_id === null) {
      data.warehouse_id = null;
    } else {
      const wh = await prisma.warehouse.findFirst({
        where: { id: input.warehouse_id, tenant_id: tenantId, is_active: true }
      });
      if (!wh) throw new Error("VALIDATION");
      data.warehouse_id = input.warehouse_id;
    }
  }
  if (input.cash_desk_id !== undefined) {
    if (input.cash_desk_id === null) {
      data.cash_desk_id = null;
    } else {
      const cd = await prisma.cashDesk.findFirst({
        where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true }
      });
      if (!cd) throw new Error("VALIDATION");
      data.cash_desk_id = input.cash_desk_id;
    }
  }
  if (input.license_until !== undefined) {
    if (input.license_until === null || input.license_until === "") {
      data.license_until = null;
    } else {
      const d = new Date(input.license_until);
      if (Number.isNaN(d.getTime())) throw new Error("VALIDATION");
      data.license_until = d;
    }
  }
  if (!skipLegacyAgentFields && input.visit_date !== undefined) {
    if (input.visit_date === null || input.visit_date === "") {
      data.visit_date = null;
    } else {
      const d = new Date(input.visit_date);
      if (Number.isNaN(d.getTime())) throw new Error("VALIDATION");
      data.visit_date = d;
    }
  }
  if (!skipLegacyAgentFields && input.agent_id !== undefined) {
    if (input.agent_id === null) {
      data.agent_id = null;
    } else {
      const u = await prisma.user.findFirst({
        where: { id: input.agent_id, tenant_id: tenantId, is_active: true }
      });
      if (!u) throw new Error("VALIDATION");
      data.agent_id = input.agent_id;
    }
  }
  if (input.contact_persons !== undefined) {
    const slots = input.contact_persons.slice(0, CONTACT_SLOTS);
    if (slots.length > CONTACT_SLOTS) throw new Error("VALIDATION");
    data.contact_persons = contactPersonsToJson(slots);
  }
  if (input.is_active !== undefined) {
    data.is_active = input.is_active;
  }

  const hasClientScalars = Object.keys(data).length > 0;
  const hasAssignments = input.agent_assignments !== undefined;
  if (!hasClientScalars && !hasAssignments) {
    throw new Error("EMPTY");
  }

  const addressTouched = clientUpdateTouchesAddress(input as Record<string, unknown>);

  await prisma.$transaction(async (tx) => {
    if (hasClientScalars) {
      await tx.client.update({ where: { id }, data });
    }
    if (hasAssignments) {
      await replaceClientAgentAssignments(tx, tenantId, id, input.agent_assignments!);
    } else if (!skipLegacyAgentFields && (input.agent_id !== undefined || input.visit_date !== undefined)) {
      await syncAssignmentSlotOneWithClientRow(tx, tenantId, id);
    }
  });

  if (
    addressTouched &&
    !hasAssignments &&
    input.agent_assignments === undefined &&
    input.agent_id === undefined
  ) {
    await applyTerritoryAutoAssignAfterAddressChange(tenantId, id);
  }

  const detail: Record<string, unknown> = { ...input };
  await appendClientAuditLog(tenantId, id, actorUserId, "client.patch", detail);
  return getClientDetail(tenantId, id);
}
