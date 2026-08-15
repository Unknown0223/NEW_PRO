import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ScopedReportActor } from "../access/access-agent-scope";
import { buildClientListWhereInput } from "./clients.list.where";
import type { ListClientsQuery } from "./clients.types";

const CLIENTS_EXPORT_MAX = 10_000;

function csvEscapeCell(v: string): string {
  const t = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
  if (/[";\n]/.test(t)) return `"${t}"`;
  return t;
}

export async function exportClientsFilteredCsv(
  tenantId: number,
  q: ListClientsQuery,
  actorScope?: ScopedReportActor
): Promise<{ csv: string; truncated: boolean; totalMatched: number }> {
  const where = await buildClientListWhereInput(tenantId, q, actorScope);
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
