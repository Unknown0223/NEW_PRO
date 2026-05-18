import { existsSync, readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { parseVisitWeekdaysJson } from "./clients.types";
import { CONTACT_SLOTS } from "./clients.helpers";
import { agentAssignmentSelectFields } from "./clients.agent-assignments";
import { buildClientListWhereInput, clientListOrderBy } from "./clients.list";
import type { ListClientsQuery } from "./clients.types";

const CLIENT_IMPORT_TEMPLATE_FILE = join(__dirname, "../../../assets/client-import-template.xlsx");

/** Lalaku «Скачать шаблон» (yangi mijoz) — asset bo‘lmasa shu sarlavhalar yoziladi. */
export function lalakuNewClientTemplateHeaders(): string[] {
  const agentCols: string[] = [];
  for (let i = 1; i <= CONTACT_SLOTS; i++) {
    agentCols.push(`Агент ${i}`, `Агент ${i} день`, `Экспедитор ${i}`);
  }
  return [
    "Наименование",
    "Юридическое название",
    "Адрес",
    "Телефон",
    "Контактное лицо",
    "Ориентир",
    "ИНН",
    "ПИНФЛ",
    "Торговый канал (код)",
    "Категория клиента (код)",
    "Тип клиента (код)",
    "Формат (код)",
    "Город (код)",
    "Широта",
    "Долгота",
    ...agentCols
  ];
}

/** Lalaku «Обновление клиентов с Excel» */
function lalakuClientUpdateTemplateHeaders(): string[] {
  const agentCols: string[] = [];
  for (let i = 1; i <= CONTACT_SLOTS; i++) {
    agentCols.push(`Агент ${i}`, `Агент ${i} день`, `Экспедитор ${i}`);
  }
  return [
    "ИД",
    "Наименование",
    "Юридическое название",
    "Контактное лицо",
    "Адрес",
    "Телефон",
    "Ориентир",
    "ИНН",
    "ПИНФЛ",
    "Торговый канал",
    "Торговый канал (код)",
    "Категория клиента",
    "Категория клиента (код)",
    "Тип клиента",
    "Тип клиента (код)",
    "Формат",
    "Формат (код)",
    "Город",
    "Город (код)",
    "Широта",
    "Долгота",
    "Код",
    "Активный",
    ...agentCols
  ];
}

export async function buildClientImportTemplateBuffer(): Promise<Buffer> {
  if (existsSync(CLIENT_IMPORT_TEMPLATE_FILE)) {
    return readFileSync(CLIENT_IMPORT_TEMPLATE_FILE);
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KPI", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  const headers = lalakuNewClientTemplateHeaders();
  ws.addRow(headers);
  const r1 = ws.getRow(1);
  r1.font = { bold: true };
  r1.eachCell((c) => {
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F4F8" }
    };
  });
  const example: string[] = headers.map((h) => {
    if (h === "Наименование") return "Misol do'kon";
    if (h === "Телефон") return "+998901112233";
    if (h === "Город (код)") return "ANDIJON SHAXAR";
    if (h.startsWith("Агент ") && !h.includes("день") && !h.startsWith("Агент 1")) return "---";
    if (h.includes("день")) return "Пн, Ср";
    if (h.startsWith("Экспедитор")) return "---";
    return "---";
  });
  ws.addRow(example);
  ws.columns = headers.map(() => ({ width: 16 }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function formatVisitWeekdaysRussian(days: number[]): string {
  const labelByDay: Record<number, string> = {
    1: "Пн",
    2: "Вт",
    3: "Ср",
    4: "Чт",
    5: "Пт",
    6: "Сб",
    7: "Вс"
  };
  return parseVisitWeekdaysJson(days)
    .map((d) => labelByDay[d] ?? "")
    .filter(Boolean)
    .join(", ");
}

type ClientUpdateTemplateFilterQuery = Omit<ListClientsQuery, "page" | "limit">;

export async function buildClientUpdateImportTemplateBuffer(
  tenantId: number,
  q: ClientUpdateTemplateFilterQuery
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("KPI", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  const headers = lalakuClientUpdateTemplateHeaders();
  ws.addRow(headers);
  const r1 = ws.getRow(1);
  r1.font = { bold: true };
  r1.eachCell((c) => {
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F4F8" }
    };
  });

  const where = await buildClientListWhereInput(tenantId, { page: 1, limit: 1, ...q });
  const sortField = q.sort ?? "name";
  const ord: Prisma.SortOrder = q.order === "desc" ? "desc" : "asc";
  const orderBy = clientListOrderBy(sortField, ord);
  const clients =
    where == null
      ? []
      : await prisma.client.findMany({
          where,
          orderBy,
          select: {
            id: true,
            name: true,
            legal_name: true,
            responsible_person: true,
            address: true,
            phone: true,
            landmark: true,
            inn: true,
            client_pinfl: true,
            sales_channel: true,
            category: true,
            client_type_code: true,
            client_format: true,
            city: true,
            latitude: true,
            longitude: true,
            client_code: true,
            is_active: true,
            agent_assignments: {
              orderBy: { slot: "asc" },
              select: {
                slot: true,
                expeditor_phone: true,
                visit_weekdays: true,
                agent: { select: { name: true, code: true } },
                expeditor_user: { select: { name: true } }
              }
            }
          }
        });

  for (const c of clients) {
    const bySlot = new Map(c.agent_assignments.map((a) => [a.slot, a]));
    const row: Array<string | number> = [
      c.id,
      c.name,
      c.legal_name ?? "",
      c.responsible_person ?? "",
      c.address ?? "",
      c.phone ?? "",
      c.landmark ?? "",
      c.inn ?? "",
      c.client_pinfl ?? "",
      c.sales_channel ?? "",
      c.sales_channel ?? "",
      c.category ?? "",
      c.category ?? "",
      c.client_type_code ?? "",
      c.client_type_code ?? "",
      c.client_format ?? "",
      c.client_format ?? "",
      c.city ?? "",
      c.city ?? "",
      c.latitude?.toString() ?? "",
      c.longitude?.toString() ?? "",
      c.client_code ?? "",
      c.is_active ? "да" : "нет"
    ];
    for (let slot = 1; slot <= CONTACT_SLOTS; slot++) {
      const item = bySlot.get(slot);
      row.push(item?.agent?.code?.trim() || item?.agent?.name?.trim() || "");
      row.push(formatVisitWeekdaysRussian(parseVisitWeekdaysJson(item?.visit_weekdays)));
      row.push(item?.expeditor_user?.name?.trim() || item?.expeditor_phone?.trim() || "");
    }
    ws.addRow(row);
  }

  ws.columns = headers.map(() => ({ width: 16 }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
