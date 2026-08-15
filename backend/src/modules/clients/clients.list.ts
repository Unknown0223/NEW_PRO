/** Clients list — export, bulk, paged. */
import type { PatchClientBody } from "../../contracts/clients.schemas";
import { updateClientFields } from "./clients.write.update";
export * from "./clients.list.where";
export { exportClientsFilteredCsv } from "./clients.list.export";
export { clientListOrderBy } from "./clients.list.sort";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import type { ClientListRow, ListClientsQuery } from "./clients.types";
import { parseContactPersonsJson } from "./clients.helpers";
import {
  agentAssignmentSelectFields,
  mapAgentAssignmentsToApi,
  mergeAgentDisplayFromAssignments
} from "./clients.agent-assignments";
import { appendClientAuditLogsBatch } from "./clients.audit";
import { invalidateClientDetailCache } from "../../lib/redis-cache";
import { buildClientListWhereInput } from "./clients.list.where";
import { clientListOrderBy } from "./clients.list.sort";

export async function bulkSetClientsActive(
  tenantId: number,
  clientIds: number[],
  is_active: boolean,
  actorUserId: number | null
): Promise<{ updated: number }> {
  const MAX = 500;
  const ids = [...new Set(clientIds.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x) && x > 0))].slice(
    0,
    MAX
  );
  if (ids.length === 0) {
    return { updated: 0 };
  }

  const existing = await prisma.client.findMany({
    where: { tenant_id: tenantId, merged_into_client_id: null, id: { in: ids } },
    select: { id: true }
  });
  const ok = existing.map((e) => e.id);
  if (ok.length === 0) {
    return { updated: 0 };
  }

  await prisma.client.updateMany({
    where: { tenant_id: tenantId, merged_into_client_id: null, id: { in: ok } },
    data: { is_active }
  });

  await appendClientAuditLogsBatch(tenantId, ok, actorUserId, "client.bulk_set_active", { is_active });
  await Promise.all(ok.map((id) => invalidateClientDetailCache(tenantId, id)));

  return { updated: ok.length };
}

function mapBulkPatchInput(patch: PatchClientBody) {
  return {
    ...patch,
    contact_persons: patch.contact_persons?.map((s) => ({
      firstName: s.firstName ?? null,
      lastName: s.lastName ?? null,
      phone: s.phone ?? null
    }))
  };
}

export async function bulkPatchClients(
  tenantId: number,
  clientIds: number[],
  patch: PatchClientBody,
  actorUserId: number | null
): Promise<{ updated: number; failed: Array<{ id: number; error: string }> }> {
  const MAX = 500;
  const ids = [...new Set(clientIds.map((x) => Math.floor(Number(x))).filter((x) => Number.isFinite(x) && x > 0))].slice(
    0,
    MAX
  );
  if (ids.length === 0) {
    return { updated: 0, failed: [] };
  }

  const mapped = mapBulkPatchInput(patch);
  let updated = 0;
  const failed: Array<{ id: number; error: string }> = [];

  for (const id of ids) {
    try {
      await updateClientFields(tenantId, id, mapped, actorUserId);
      await invalidateClientDetailCache(tenantId, id);
      updated += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN";
      failed.push({ id, error: msg });
    }
  }

  return { updated, failed };
}

export async function listClientsForTenantPaged(
  tenantId: number,
  q: ListClientsQuery
): Promise<{ data: ClientListRow[]; total: number; page: number; limit: number }> {
  const whereInput = await buildClientListWhereInput(tenantId, q);
  if (whereInput === null) {
    return { data: [], total: 0, page: q.page, limit: q.limit };
  }
  const where: Prisma.ClientWhereInput = whereInput;

  const sortField = q.sort ?? "name";
  const ord: Prisma.SortOrder = q.order === "desc" ? "desc" : "asc";
  const orderBy = clientListOrderBy(sortField, ord);

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      orderBy,
      select: {
        id: true,
        name: true,
        legal_name: true,
        phone: true,
        address: true,
        category: true,
        client_type_code: true,
        credit_limit: true,
        is_active: true,
        created_at: true,
        responsible_person: true,
        landmark: true,
        inn: true,
        pdl: true,
        logistics_service: true,
        license_until: true,
        working_hours: true,
        region: true,
        district: true,
        city: true,
        neighborhood: true,
        street: true,
        house_number: true,
        apartment: true,
        gps_text: true,
        visit_date: true,
        notes: true,
        client_format: true,
        client_code: true,
        sales_channel: true,
        product_category_ref: true,
        bank_name: true,
        bank_account: true,
        bank_mfo: true,
        client_pinfl: true,
        oked: true,
        contract_number: true,
        vat_reg_code: true,
        latitude: true,
        longitude: true,
        zone: true,
        warehouse_id: true,
        cash_desk_id: true,
        price_type: true,
        allow_order_with_debt: true,
        allow_consignment: true,
        allow_consignment_with_debt: true,
        contact_persons: true,
        agent_id: true,
        agent: { select: { name: true, code: true } },
        warehouse: { select: { name: true } },
        cash_desk: { select: { name: true } },
        agent_assignments: {
          orderBy: { slot: "asc" },
          select: agentAssignmentSelectFields
        },
        tag_links: {
          select: { tag: { select: { id: true, name: true } } }
        },
        _count: {
          select: {
            client_equipment: { where: { removed_at: null } }
          }
        },
        client_balances: { take: 1, select: { balance: true } }
      }
    })
  ]);

  const pageIds = clients.map((cl) => cl.id);
  const deliveryMap =
    pageIds.length === 0 ? new Map() : await loadDeliveryDebtByClient(tenantId, pageIds);

  return {
    data: clients.map((c) => {
      const ledger = c.client_balances[0]?.balance ?? new Prisma.Decimal(0);
      const mergedBal = mergeLedgerWithUnpaidDelivered(ledger, deliveryMap.get(c.id));
      const agent_assignments = mapAgentAssignmentsToApi(c.agent_assignments);
      const visitLegacy = c.visit_date?.toISOString() ?? null;
      const disp = mergeAgentDisplayFromAssignments(
        c.agent_id,
        c.agent?.name ?? null,
        visitLegacy,
        agent_assignments
      );
      return {
        id: c.id,
        name: c.name,
        legal_name: c.legal_name,
        phone: c.phone,
        address: c.address,
        category: c.category,
        client_type_code: c.client_type_code,
        credit_limit: c.credit_limit.toString(),
        is_active: c.is_active,
        account_balance: mergedBal.toString(),
        responsible_person: c.responsible_person,
        landmark: c.landmark,
        inn: c.inn,
        pdl: c.pdl,
        logistics_service: c.logistics_service,
        license_until: c.license_until?.toISOString() ?? null,
        working_hours: c.working_hours,
        region: c.region,
        district: c.district,
        city: c.city,
        neighborhood: c.neighborhood,
        street: c.street,
        house_number: c.house_number,
        apartment: c.apartment,
        gps_text: c.gps_text,
        visit_date: disp.visit_date,
        notes: c.notes,
        client_format: c.client_format,
        client_code: c.client_code,
        sales_channel: c.sales_channel,
        product_category_ref: c.product_category_ref,
        bank_name: c.bank_name,
        bank_account: c.bank_account,
        bank_mfo: c.bank_mfo,
        client_pinfl: c.client_pinfl,
        oked: c.oked,
        contract_number: c.contract_number,
        vat_reg_code: c.vat_reg_code,
        latitude: c.latitude != null ? c.latitude.toString() : null,
        longitude: c.longitude != null ? c.longitude.toString() : null,
        zone: c.zone,
        warehouse_id: c.warehouse_id,
        warehouse_name: c.warehouse?.name ?? null,
        cash_desk_id: c.cash_desk_id,
        cash_desk_name: c.cash_desk?.name ?? null,
        agent_id: disp.agent_id,
        agent_name: disp.agent_name,
        agent_assignments,
        contact_persons: parseContactPersonsJson(c.contact_persons),
        created_at: c.created_at.toISOString(),
        active_equipment_count: c._count.client_equipment,
        price_type: c.price_type,
        allow_order_with_debt: c.allow_order_with_debt,
        allow_consignment: c.allow_consignment,
        allow_consignment_with_debt: c.allow_consignment_with_debt,
        tags: c.tag_links.map((l) => ({ id: l.tag.id, name: l.tag.name }))
      };
    }),
    total,
    page: q.page,
    limit: q.limit
  };
}
