import { prisma } from "../../config/database";
import { listClientsForTenantPaged } from "../clients/clients.list";
import {
  cellStr,
  CLIENT_HEADERS,
  WORK_SLOT_HEADERS,
  type ExportSheet
} from "./initial-setup-export.shared";

export async function collectClientExportSheets(tenantId: number): Promise<ExportSheet[]> {
  const sheets: ExportSheet[] = [];

  const allClients: Array<Record<string, unknown>> = [];
  const limit = 500;
  let page = 1;
  let total = Infinity;
  while (allClients.length < total && page <= 50) {
    const batch = await listClientsForTenantPaged(tenantId, { page, limit });
    total = batch.total;
    for (const c of batch.data) {
      allClients.push(c as unknown as Record<string, unknown>);
    }
    if (batch.data.length < limit) break;
    page += 1;
  }
  if (allClients.length) {
    const clientRows = allClients.map((c) => [
      cellStr(c.name),
      cellStr(c.legal_name),
      cellStr(c.address),
      cellStr(c.phone),
      cellStr(c.responsible_person),
      cellStr(c.landmark),
      cellStr(c.inn),
      cellStr(c.client_pinfl),
      cellStr(c.sales_channel),
      cellStr(c.category),
      cellStr(c.client_type_code),
      cellStr(c.client_format),
      cellStr(c.city),
      cellStr(c.latitude),
      cellStr(c.longitude)
    ]);
    sheets.push({
      sheetName: "clients",
      rows: [[...CLIENT_HEADERS], ...clientRows]
    });
  }

  const slots = await prisma.workSlot.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ sort_order: "asc" }, { slot_code: "asc" }],
    include: {
      user_links: {
        where: { ended_at: null },
        take: 1,
        include: { user: { select: { login: true } } }
      }
    }
  });
  if (slots.length) {
    const slotRows = slots.map((r) => [
      r.slot_code,
      r.label ?? "",
      r.branch_code ?? "",
      r.slot_type,
      r.is_active ? "yes" : "no",
      String(r.sort_order ?? ""),
      r.user_links[0]?.user.login ?? ""
    ]);
    sheets.push({
      sheetName: "work-slots",
      rows: [[...WORK_SLOT_HEADERS], ...slotRows]
    });
  }

  return sheets;
}
