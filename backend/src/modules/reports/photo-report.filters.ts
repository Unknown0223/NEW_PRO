import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  filterTerritoryRowsByTerms,
  pruneTerritoryNodesByTerms,
  resolveFilterOptionsScope,
  staffWhereForFilterOptions
} from "../access/access-filter-options-scope";
import { mergeTerritoryFilterOptions, parseTerritoryNodes } from "./territory-nodes";
import { clientRefEntriesFromUnknown } from "../tenant-settings/tenant-settings.refs";

export async function getPhotoReportFilterOptions(tenantId: number, actor?: ReportActor) {
  const scope = await resolveFilterOptionsScope(tenantId, actor);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};

  const photoCatsFromSettings = clientRefEntriesFromUnknown(refs.photo_category_entries)
    .filter((e) => e.active !== false)
    .map((e) => e.name.trim())
    .filter(Boolean);

  const [users, clientCats, captionRows, territoryRowsRaw] = await Promise.all([
    prisma.user.findMany({
      where: staffWhereForFilterOptions(tenantId, scope, ["agent", "expeditor", "supervisor"]),
      select: { id: true, name: true, code: true, role: true },
      orderBy: { name: "asc" },
      take: 3000
    }),
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT c.category AS v
      FROM clients c
      WHERE c.tenant_id = ${tenantId} AND c.category IS NOT NULL AND c.category <> ''
      ORDER BY c.category
    `,
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT COALESCE(NULLIF(btrim(pr.caption), ''), 'Без категории') AS v
      FROM client_photo_reports pr
      WHERE pr.tenant_id = ${tenantId}
      ORDER BY 1
    `,
    prisma.$queryRaw<Array<{ t1: string | null; t2: string | null; t3: string | null }>>`
      SELECT DISTINCT c.zone AS t1, c.region AS t2, c.city AS t3
      FROM clients c
      WHERE c.tenant_id = ${tenantId}
    `
  ]);

  const territoryRows = filterTerritoryRowsByTerms(territoryRowsRaw, scope.territoryTerms);
  const refsForTerritory =
    scope.territoryTerms === null
      ? refs
      : {
          ...refs,
          territory_nodes: pruneTerritoryNodesByTerms(parseTerritoryNodes(refs.territory_nodes), scope.territoryTerms)
        };
  const territoryOpts = mergeTerritoryFilterOptions(refsForTerritory, territoryRows);

  const photo_categories = [
    ...new Set([...photoCatsFromSettings, ...captionRows.map((r) => r.v)])
  ].sort((a, b) => a.localeCompare(b, "ru"));

  return {
    archive: [
      { id: "active", label: "Активные" },
      { id: "void", label: "Архив" },
      { id: "all", label: "Все" }
    ],
    client_active: [
      { id: "all", label: "Все клиенты" },
      { id: "active", label: "Активные клиенты" },
      { id: "inactive", label: "Неактивные клиенты" }
    ],
    user_roles: [
      { id: "agent", label: "Агент" },
      { id: "expeditor", label: "Экспедитор" },
      { id: "supervisor", label: "Супервайзер" }
    ],
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      code: u.code ?? "",
      role: u.role ?? ""
    })),
    photo_categories,
    client_categories: clientCats.map((r) => r.v),
    territory_1: territoryOpts.territory_1,
    territory_2: territoryOpts.territory_2,
    territory_3: territoryOpts.territory_3
  };
}
