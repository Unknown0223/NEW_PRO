import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientDedupePreviewDto, DuplicateCandidatesQuery, DuplicateGroupDto, DuplicateTab } from "./client-dedupe.types";
import { MAX_GROUPS, MAX_IDS_PER_GROUP } from "./client-dedupe.constants";
import { loadClientPreviewsMap } from "./client-dedupe.preview";
import { clientWhereFragment } from "./client-dedupe.sql";

function attachPreviews(groups: DuplicateGroupDto[], previewMap: Map<number, ClientDedupePreviewDto>): void {
  for (const g of groups) {
    g.previews = g.client_ids
      .map((id) => previewMap.get(id))
      .filter((x): x is ClientDedupePreviewDto => x != null);
  }
}

export async function listDuplicateCandidates(
  tenantId: number,
  q: DuplicateCandidatesQuery
): Promise<{
  tab: DuplicateTab;
  groups: DuplicateGroupDto[];
  total: number;
  page: number;
  limit: number;
  truncated: boolean;
}> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(100, Math.max(1, q.limit ?? 10));
  const base = clientWhereFragment(tenantId, q);

  if (q.tab === "geo") {
    const rows = await prisma.$queryRaw<
      Array<{
        rlat: string;
        rlon: string;
        ids: number[];
        cnt: bigint;
      }>
    >(Prisma.sql`
      SELECT round(c.latitude::numeric, 5)::text AS rlat,
             round(c.longitude::numeric, 5)::text AS rlon,
             array_agg(c.id ORDER BY c.id) AS ids,
             COUNT(*)::bigint AS cnt
      FROM clients c
      WHERE ${base}
        AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
      GROUP BY round(c.latitude::numeric, 5), round(c.longitude::numeric, 5)
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
      LIMIT ${MAX_GROUPS + 1}
    `);
    const truncated = rows.length > MAX_GROUPS;
    const slice = rows.slice(0, MAX_GROUPS);
    const groups: DuplicateGroupDto[] = [];
    for (const r of slice) {
      const ids = (r.ids ?? []).slice(0, MAX_IDS_PER_GROUP);
      groups.push({
        reason: "geo",
        score: 70,
        key: `${r.rlat},${r.rlon}`,
        client_ids: ids,
        count: Number(r.cnt),
        previews: []
      });
    }
    const allIds = groups.flatMap((g) => g.client_ids);
    const pmap = await loadClientPreviewsMap(tenantId, allIds);
    attachPreviews(groups, pmap);
    const total = groups.length;
    const start = (page - 1) * limit;
    return {
      tab: "geo",
      groups: groups.slice(start, start + limit),
      total,
      page,
      limit,
      truncated
    };
  }

  const phoneRows = await prisma.$queryRaw<
    Array<{ phone_normalized: string; ids: number[]; cnt: bigint }>
  >(Prisma.sql`
    SELECT c.phone_normalized AS phone_normalized,
           array_agg(c.id ORDER BY c.id) AS ids,
           COUNT(*)::bigint AS cnt
    FROM clients c
    WHERE ${base}
      AND c.phone_normalized IS NOT NULL AND length(trim(c.phone_normalized)) > 5
    GROUP BY c.phone_normalized
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT ${MAX_GROUPS + 1}
  `);
  const phoneTrunc = phoneRows.length > MAX_GROUPS;
  const phoneSlice = phoneRows.slice(0, MAX_GROUPS);
  const groups: DuplicateGroupDto[] = [];
  for (const r of phoneSlice) {
    const ids = (r.ids ?? []).slice(0, MAX_IDS_PER_GROUP);
    groups.push({
      reason: "phone",
      score: 90,
      key: r.phone_normalized,
      client_ids: ids,
      count: Number(r.cnt),
      previews: []
    });
  }

  const nameRows = await prisma.$queryRaw<
    Array<{ nk: string; ids: number[]; cnt: bigint }>
  >(Prisma.sql`
    SELECT upper(regexp_replace(trim(c.name), '\\s+', ' ', 'g')) AS nk,
           array_agg(c.id ORDER BY c.id) AS ids,
           COUNT(*)::bigint AS cnt
    FROM clients c
    WHERE ${base}
      AND length(trim(c.name)) >= 4
    GROUP BY upper(regexp_replace(trim(c.name), '\\s+', ' ', 'g'))
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT ${Math.max(0, MAX_GROUPS - groups.length) + 1}
  `);
  const nameTrunc = nameRows.length > Math.max(0, MAX_GROUPS - groups.length);
  const nameSlice = nameRows.slice(0, Math.max(0, MAX_GROUPS - groups.length));
  for (const r of nameSlice) {
    const ids = (r.ids ?? []).slice(0, MAX_IDS_PER_GROUP);
    groups.push({
      reason: "name",
      score: 50,
      key: r.nk,
      client_ids: ids,
      count: Number(r.cnt),
      previews: []
    });
  }

  const allIds = groups.flatMap((g) => g.client_ids);
  const pmap = await loadClientPreviewsMap(tenantId, allIds);
  attachPreviews(groups, pmap);

  const total = groups.length;
  const start = (page - 1) * limit;
  return {
    tab: "fields",
    groups: groups.slice(start, start + limit),
    total,
    page,
    limit,
    truncated: phoneTrunc || nameTrunc
  };
}
