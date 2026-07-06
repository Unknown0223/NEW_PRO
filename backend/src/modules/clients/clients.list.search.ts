import type { Prisma } from "@prisma/client";
import {
  isExternalClientCode,
  parseExternalClientCodeSuffix
} from "../../../shared/client-display-id";

/** Klientlar ro‘yxati: `search` query — jadvaldagi matn ustunlari + agent / ekspeditor */
export function buildClientListSearchOrClause(searchRaw: string): Prisma.ClientWhereInput[] {
  const search = searchRaw.trim();
  if (!search) return [];

  const ins = "insensitive" as const;

  if (isExternalClientCode(search)) {
    const suffixId = parseExternalClientCodeSuffix(search);
    const parts: Prisma.ClientWhereInput[] = [
      { client_code: { equals: search, mode: ins } }
    ];
    if (suffixId != null) parts.push({ id: suffixId });
    return parts;
  }

  const orClause: Prisma.ClientWhereInput[] = [
    { name: { contains: search, mode: ins } },
    { legal_name: { contains: search, mode: ins } },
    { client_code: { contains: search, mode: ins } },
    { phone: { contains: search, mode: ins } },
    { inn: { contains: search, mode: ins } },
    { client_pinfl: { contains: search, mode: ins } },
    { region: { contains: search, mode: ins } },
    { city: { contains: search, mode: ins } },
    { district: { contains: search, mode: ins } },
    { zone: { contains: search, mode: ins } },
    { neighborhood: { contains: search, mode: ins } },
    { landmark: { contains: search, mode: ins } },
    { responsible_person: { contains: search, mode: ins } },
    { notes: { contains: search, mode: ins } },
    { street: { contains: search, mode: ins } },
    { address: { contains: search, mode: ins } },
    { category: { contains: search, mode: ins } },
    { client_type_code: { contains: search, mode: ins } },
    { client_format: { contains: search, mode: ins } },
    { sales_channel: { contains: search, mode: ins } },
    { logistics_service: { contains: search, mode: ins } },
    { product_category_ref: { contains: search, mode: ins } }
  ];

  const agentMatch: Prisma.UserWhereInput = {
    OR: [
      { name: { contains: search, mode: ins } },
      { code: { contains: search, mode: ins } },
      { login: { contains: search, mode: ins } }
    ]
  };
  orClause.push({ agent: agentMatch });
  orClause.push({ agent_assignments: { some: { agent: agentMatch } } });
  orClause.push({
    agent_assignments: {
      some: {
        OR: [
          { expeditor_phone: { contains: search, mode: ins } },
          { expeditor_user: agentMatch }
        ]
      }
    }
  });

  const idDigits = search.replace(/\s+/g, "");
  if (/^\d+$/.test(idDigits)) {
    const idNum = Number.parseInt(idDigits, 10);
    if (Number.isFinite(idNum) && idNum > 0) {
      orClause.push({ id: idNum });
    }
  }

  return orClause;
}
