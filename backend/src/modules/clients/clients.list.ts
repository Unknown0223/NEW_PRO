/** Clients list — export, bulk, paged. */
export * from "./clients.list.where";
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
import { appendClientAuditLog } from "./clients.audit";
import { buildClientListWhereInput } from "./clients.list.where";

const CLIENTS_EXPORT_MAX = 10_000;

function csvEscapeCell(v: string): string {
  const t = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
  if (/[";\n]/.test(t)) return `"${t}"`;
  return t;
}

export async function exportClientsFilteredCsv(
  tenantId: number,
  q: ListClientsQuery
): Promise<{ csv: string; truncated: boolean; totalMatched: number }> {
  const where = await buildClientListWhereInput(tenantId, q);
  const headers = [
    "ID",
    "Nomi",
    "Firma",
    "Telefon",
    "INN",
    "Viloyat",
    "Shahar",
    "Tuman",
    "Zona",
    "Toifa",
    "Tur",
    "Format",
    "Savdo kanali",
    "Faol",
    "Yaratilgan"
  ];
  if (where === null) {
    return {
      csv: `\ufeff${headers.map(csvEscapeCell).join(";")}\n`,
      truncated: false,
      totalMatched: 0
    };
  }

  const totalMatched = await prisma.client.count({ where });
  const rows = await prisma.client.findMany({
    where,
    take: CLIENTS_EXPORT_MAX,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      legal_name: true,
      phone: true,
      inn: true,
      region: true,
      city: true,
      district: true,
      zone: true,
      category: true,
      client_type_code: true,
      client_format: true,
      sales_channel: true,
      is_active: true,
      created_at: true
    }
  });

  const lines = [
    headers.map(csvEscapeCell).join(";"),
    ...rows.map((r) =>
      [
        String(r.id),
        r.name ?? "",
        r.legal_name ?? "",
        r.phone ?? "",
        r.inn ?? "",
        r.region ?? "",
        r.city ?? "",
        r.district ?? "",
        r.zone ?? "",
        r.category ?? "",
        r.client_type_code ?? "",
        r.client_format ?? "",
        r.sales_channel ?? "",
        r.is_active ? "ha" : "yo‘q",
        r.created_at.toISOString().slice(0, 10)
      ]
        .map(csvEscapeCell)
        .join(";")
    )
  ];

  return {
    csv: `\ufeff${lines.join("\n")}`,
    truncated: totalMatched > CLIENTS_EXPORT_MAX,
    totalMatched
  };
}

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

  for (const id of ok) {
    await appendClientAuditLog(tenantId, id, actorUserId, "client.bulk_set_active", { is_active });
  }

  return { updated: ok.length };
}

export function clientListOrderBy(
  sortField: NonNullable<ListClientsQuery["sort"]>,
  ord: Prisma.SortOrder
): Prisma.ClientOrderByWithRelationInput {
  switch (sortField) {
    case "phone":
      return { phone: ord };
    case "id":
      return { id: ord };
    case "created_at":
      return { created_at: ord };
    case "region":
      return { region: ord };
    case "legal_name":
      return { legal_name: ord };
    case "address":
      return { address: ord };
    case "responsible_person":
      return { responsible_person: ord };
    case "landmark":
      return { landmark: ord };
    case "inn":
      return { inn: ord };
    case "client_pinfl":
      return { client_pinfl: ord };
    case "sales_channel":
      return { sales_channel: ord };
    case "category":
      return { category: ord };
    case "client_type_code":
      return { client_type_code: ord };
    case "client_format":
      return { client_format: ord };
    case "district":
      return { district: ord };
    case "neighborhood":
      return { neighborhood: ord };
    case "zone":
      return { zone: ord };
    case "city":
      return { city: ord };
    case "client_code":
      return { client_code: ord };
    case "latitude":
      return { latitude: ord };
    case "longitude":
      return { longitude: ord };
    case "name":
    default:
      return { name: ord };
  }
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
        contact_persons: true,
        agent_id: true,
        agent: { select: { name: true, code: true } },
        agent_assignments: {
          orderBy: { slot: "asc" },
          select: agentAssignmentSelectFields
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
        agent_id: disp.agent_id,
        agent_name: disp.agent_name,
        agent_assignments,
        contact_persons: parseContactPersonsJson(c.contact_persons),
        created_at: c.created_at.toISOString()
      };
    }),
    total,
    page: q.page,
    limit: q.limit
  };
}
