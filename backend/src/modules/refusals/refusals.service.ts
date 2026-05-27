import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getTenantProfile } from "../tenant-settings/tenant-settings.profile.read";
import type {
  ClientRefusalFilterOptions,
  ClientRefusalListRow,
  ListClientRefusalsQuery
} from "./refusals.types";

function parseYmdStart(ymd: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0));
}

function parseYmdEnd(ymd: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return undefined;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
}

function reasonLabelMap(tenantId: number): Promise<Map<string, string>> {
  return getTenantProfile(tenantId).then((profile) => {
    const entries = profile.references.refusal_reason_entries ?? [];
    const map = new Map<string, string>();
    for (const e of entries) {
      const value = (e.code?.trim() || e.name?.trim() || "").trim();
      if (value) map.set(value, e.name?.trim() || value);
    }
    return map;
  });
}

export async function listClientRefusals(
  tenantId: number,
  q: ListClientRefusalsQuery
): Promise<{
  data: ClientRefusalListRow[];
  total: number;
  page: number;
  limit: number;
  stats_by_reason: Array<{ reason_ref: string; reason_label: string; count: number }>;
}> {
  // Note: `prisma.clientRefusal` modeli hozircha `prisma generate` bo‘lmasligi mumkin,
  // shuning uchun table’ga raw SQL bilan chiqamiz.
  const labels = await reasonLabelMap(tenantId);

  const conditions: Prisma.Sql[] = [Prisma.sql`cr.tenant_id = ${tenantId}`];

  if (q.date_from) {
    const from = parseYmdStart(q.date_from);
    if (from) conditions.push(Prisma.sql`cr.created_at >= ${from}`);
  }
  if (q.date_to) {
    const to = parseYmdEnd(q.date_to);
    if (to) conditions.push(Prisma.sql`cr.created_at <= ${to}`);
  }
  if (q.agent_id != null && q.agent_id > 0) {
    conditions.push(Prisma.sql`cr.agent_id = ${q.agent_id}`);
  }
  if (q.refusal_reason_ref?.trim()) {
    conditions.push(Prisma.sql`cr.refusal_reason_ref = ${q.refusal_reason_ref.trim()}`);
  }

  if (q.client_category?.trim()) conditions.push(Prisma.sql`c.category = ${q.client_category.trim()}`);
  if (q.zone?.trim()) conditions.push(Prisma.sql`c.zone = ${q.zone.trim()}`);
  if (q.region?.trim()) conditions.push(Prisma.sql`c.region = ${q.region.trim()}`);
  if (q.city?.trim()) conditions.push(Prisma.sql`c.city = ${q.city.trim()}`);

  if (q.search?.trim()) {
    const needle = `%${q.search.trim()}%`;
    conditions.push(
      Prisma.sql`(
        c.name ILIKE ${needle}
        OR u.name ILIKE ${needle}
        OR u.code ILIKE ${needle}
        OR cr.territory ILIKE ${needle}
      )`
    );
  }

  // Prisma.join() second arg sifatida plain string ishlatish xavfsizroq,
  // aks holda u separator o‘rniga `Object` param sifatida tushib qolishi mumkin.
  const where = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  // ORDER BY ni dynamic Prisma.sql fragment bilan emas, balki whitelisted raw string bilan inline qilamiz.
  // Aks holda Prisma "Object"ni parametr sifatida SQLga kiritib yuborishi mumkin.
  const dirSql = q.sort_dir === "asc" ? "ASC" : "DESC";
  const orderByField =
    q.sort_by === "client"
      ? "c.name"
      : q.sort_by === "agent"
        ? "u.name"
        : q.sort_by === "reason"
          ? "cr.refusal_reason_ref"
          : "cr.created_at";

  const cap = q.max_limit ?? 100;
  const limit = Math.min(cap, Math.max(1, q.limit));
  const offset = Math.max(0, (q.page - 1) * limit);

  const [totalRow, rows, groups] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM client_refusals cr
      JOIN clients c ON c.id = cr.client_id AND c.tenant_id = cr.tenant_id
      JOIN users u ON u.id = cr.agent_id AND u.tenant_id = cr.tenant_id
      ${where}
    `),
    prisma.$queryRaw<
      Array<{
        id: number;
        client_id: number;
        client_name: string;
        agent_id: number;
        agent_code: string | null;
        agent_name: string;
        refusal_reason_ref: string;
        territory: string | null;
        comment: string | null;
        created_at: Date;
      }>
    >(Prisma.sql`
      SELECT
        cr.id,
        cr.client_id,
        c.name AS client_name,
        cr.agent_id,
        u.code AS agent_code,
        u.name AS agent_name,
        cr.refusal_reason_ref,
        cr.territory,
        cr.comment,
        cr.created_at
      FROM client_refusals cr
      JOIN clients c ON c.id = cr.client_id AND c.tenant_id = cr.tenant_id
      JOIN users u ON u.id = cr.agent_id AND u.tenant_id = cr.tenant_id
      ${where}
      ORDER BY ${Prisma.raw(orderByField)} ${Prisma.raw(dirSql)}
      LIMIT ${limit} OFFSET ${offset}
    `),
    prisma.$queryRaw<
      Array<{ refusal_reason_ref: string; count: number }>
    >(Prisma.sql`
      SELECT
        cr.refusal_reason_ref,
        COUNT(*)::int AS count
      FROM client_refusals cr
      JOIN clients c ON c.id = cr.client_id AND c.tenant_id = cr.tenant_id
      JOIN users u ON u.id = cr.agent_id AND u.tenant_id = cr.tenant_id
      ${where}
      GROUP BY cr.refusal_reason_ref
      ORDER BY count DESC
    `)
  ]);

  const total = totalRow[0]?.total ?? 0;
  const data: ClientRefusalListRow[] = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    client_name: r.client_name,
    agent_id: r.agent_id,
    agent_code: r.agent_code,
    agent_name: r.agent_name,
    refusal_reason_ref: r.refusal_reason_ref,
    refusal_reason_label: labels.get(r.refusal_reason_ref) ?? r.refusal_reason_ref,
    territory: r.territory,
    comment: r.comment,
    created_at: (r.created_at instanceof Date ? r.created_at : new Date(r.created_at)).toISOString()
  }));

  const stats_by_reason = groups.map((g) => ({
    reason_ref: g.refusal_reason_ref,
    reason_label: labels.get(g.refusal_reason_ref) ?? g.refusal_reason_ref,
    count: g.count
  }));

  return { data, total, page: q.page, limit, stats_by_reason };
}

export async function getClientRefusalFilterOptions(
  tenantId: number
): Promise<ClientRefusalFilterOptions> {
  const [refs, agents, catRows, zoneRows, regionRows, cityRows] = await Promise.all([
    getTenantProfile(tenantId),
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: "agent", is_active: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: "asc" },
      take: 500
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, merged_into_client_id: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      take: 200
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, merged_into_client_id: null, zone: { not: null } },
      select: { zone: true },
      distinct: ["zone"],
      take: 200
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, merged_into_client_id: null, region: { not: null } },
      select: { region: true },
      distinct: ["region"],
      take: 200
    }),
    prisma.client.findMany({
      where: { tenant_id: tenantId, merged_into_client_id: null, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
      take: 200
    })
  ]);

  const labels = await reasonLabelMap(tenantId);
  const reasons: ClientRefusalFilterOptions["reasons"] = [];
  const seen = new Set<string>();
  for (const e of refs.references.refusal_reason_entries ?? []) {
    if (e.active === false) continue;
    const value = (e.code?.trim() || e.name?.trim())?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    reasons.push({
      value,
      label: (e.name?.trim() || e.code?.trim() || value)!
    });
  }

  if (reasons.length === 0) {
    const distinct = await prisma.$queryRaw<Array<{ refusal_reason_ref: string }>>(Prisma.sql`
      SELECT DISTINCT cr.refusal_reason_ref
      FROM client_refusals cr
      WHERE cr.tenant_id = ${tenantId}
      ORDER BY cr.refusal_reason_ref ASC
      LIMIT 200
    `);
    for (const row of distinct) {
      const value = row.refusal_reason_ref?.trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      reasons.push({
        value,
        label: labels.get(value) ?? value
      });
    }
  }

  return {
    agents: agents.map((a) => ({ id: a.id, code: a.code, name: a.name })),
    reasons,
    client_categories: catRows.map((r) => r.category!).filter(Boolean).sort(),
    zones: zoneRows.map((r) => r.zone!).filter(Boolean).sort(),
    regions: regionRows.map((r) => r.region!).filter(Boolean).sort(),
    cities: cityRows.map((r) => r.city!).filter(Boolean).sort()
  };
}

export async function createClientRefusal(
  tenantId: number,
  agentId: number,
  input: {
    client_id: number;
    refusal_reason_ref: string;
    comment?: string | null;
    created_at?: Date | null;
  }
): Promise<ClientRefusalListRow> {
  const reasonRef = input.refusal_reason_ref.trim().slice(0, 128);
  if (!reasonRef) throw new Error("ReasonRequired");

  const [client, agent] = await Promise.all([
    prisma.client.findFirst({
      where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null },
      select: { id: true, name: true, zone: true }
    }),
    prisma.user.findFirst({
      where: { id: agentId, tenant_id: tenantId, role: "agent", is_active: true },
      select: { id: true, name: true, code: true, territory: true }
    })
  ]);
  if (!client) throw new Error("ClientNotFound");
  if (!agent) throw new Error("AgentNotFound");

  const territory =
    client.zone?.trim() || agent.territory?.trim() || null;
  const comment = input.comment?.trim()
    ? input.comment.trim().slice(0, 2000)
    : null;
  const createdAt = input.created_at ?? new Date();

  const inserted = await prisma.$queryRaw<Array<{ id: number; created_at: Date }>>(Prisma.sql`
    INSERT INTO client_refusals (
      tenant_id,
      client_id,
      agent_id,
      refusal_reason_ref,
      territory,
      comment,
      created_at
    ) VALUES (
      ${tenantId},
      ${client.id},
      ${agent.id},
      ${reasonRef},
      ${territory},
      ${comment},
      ${createdAt}
    )
    RETURNING id, created_at
  `);

  const labels = await reasonLabelMap(tenantId);
  const id = inserted[0]?.id;
  if (id == null) throw new Error("RefusalInsertFailed");

  return {
    id,
    client_id: client.id,
    client_name: client.name,
    agent_id: agent.id,
    agent_code: agent.code,
    agent_name: agent.name,
    refusal_reason_ref: reasonRef,
    refusal_reason_label: labels.get(reasonRef) ?? reasonRef,
    territory,
    comment,
    created_at: (inserted[0]!.created_at instanceof Date ? inserted[0]!.created_at : new Date(inserted[0]!.created_at)).toISOString()
  };
}
