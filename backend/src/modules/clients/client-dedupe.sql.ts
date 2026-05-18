import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { DuplicateCandidatesQuery } from "./client-dedupe.types";
import { normalizeSearchFields } from "./client-dedupe.helpers";

export function clientWhereFragment(tenantId: number, q: DuplicateCandidatesQuery): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const act = q.is_active ?? "all";
  if (act === "yes") parts.push(Prisma.sql`c.is_active = TRUE`);
  if (act === "no") parts.push(Prisma.sql`c.is_active = FALSE`);
  if (q.agent_id != null && Number.isFinite(q.agent_id)) {
    parts.push(Prisma.sql`c.agent_id = ${q.agent_id}`);
  }
  if (q.zone?.trim()) parts.push(Prisma.sql`COALESCE(c.zone,'') = ${q.zone.trim()}`);
  if (q.region?.trim()) parts.push(Prisma.sql`COALESCE(c.region,'') = ${q.region.trim()}`);
  if (q.city?.trim()) parts.push(Prisma.sql`COALESCE(c.city,'') = ${q.city.trim()}`);
  if (q.client_format?.trim()) parts.push(Prisma.sql`COALESCE(c.client_format,'') = ${q.client_format.trim()}`);
  if (q.category?.trim()) parts.push(Prisma.sql`COALESCE(c.category,'') = ${q.category.trim()}`);
  const types = (q.client_type_codes ?? []).map((t) => t.trim()).filter(Boolean);
  if (types.length === 1) {
    parts.push(Prisma.sql`COALESCE(c.client_type_code,'') = ${types[0]}`);
  } else if (types.length > 1) {
    const frag = Prisma.join(types.map((t) => Prisma.sql`${t}`));
    parts.push(Prisma.sql`c.client_type_code IN (${frag})`);
  }
  const search = q.search?.trim();
  if (search) {
    const p = `%${search}%`;
    const fields = normalizeSearchFields(q.search_fields);
    const ors: Prisma.Sql[] = [];
    for (const f of fields) {
      if (f === "name") ors.push(Prisma.sql`c.name ILIKE ${p}`);
      if (f === "legal_name") ors.push(Prisma.sql`COALESCE(c.legal_name,'') ILIKE ${p}`);
      if (f === "phone") ors.push(Prisma.sql`COALESCE(c.phone,'') ILIKE ${p}`);
      if (f === "inn") ors.push(Prisma.sql`COALESCE(c.inn,'') ILIKE ${p}`);
      if (f === "pinfl") ors.push(Prisma.sql`COALESCE(c.client_pinfl,'') ILIKE ${p}`);
      if (f === "contract") ors.push(Prisma.sql`COALESCE(c.contract_number,'') ILIKE ${p}`);
      if (f === "address") ors.push(Prisma.sql`COALESCE(c.address,'') ILIKE ${p}`);
    }
    if (ors.length > 0) parts.push(Prisma.sql`(${Prisma.join(ors, " OR ")})`);
  }
  return Prisma.join(parts, " AND ");
}
