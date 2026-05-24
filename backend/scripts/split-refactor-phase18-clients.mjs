/**
 * v3 — clients bosqich 2: audit, references, list.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const clients = path.join(root, "../src/modules/clients");
const mainPath = path.join(clients, "clients.service.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

const lines = read(mainPath);

w(
  path.join(clients, "clients.audit.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";

${slice(lines, 1257, 1283)}
`
);

w(
  path.join(clients, "clients.references.ts"),
  `import { prisma } from "../../config/database";
import { getRedisForApp } from "../../lib/redis-cache";
import { salesRefStoredValue } from "../sales-directions/sales-directions.service";
import {
  activeValuesFromClientRefEntries,
  buildCityTerritoryHints,
  clientRefEntriesFromUnknown,
  referencesWithResolvedTerritoryNodes,
  territoryCityStoredPairs,
  territoryRegionPickerNames,
  territoryRegionStoredPairs
} from "../tenant-settings/tenant-settings.service";
import type { ClientReferences } from "./clients.types";
import {
  mergeClientRefSelectOpts,
  mergeSalesChannelSelectOpts,
  mergeCitySelectOpts,
  normalizeDistinct
} from "./clients.helpers";

${slice(lines, 80, 241)}
`
);

w(
  path.join(clients, "clients.list.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../client-balances/client-balances.service";
import {
  buildCityTerritoryHints,
  expandRegionFilterSynonyms,
  referencesWithResolvedTerritoryNodes
} from "../tenant-settings/tenant-settings.service";
import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.service";
import { normKeyTerritoryMatch } from "../../../shared/territory-lalaku-seed";
import type { ClientListRow, ListClientsQuery } from "./clients.types";
import { parseContactPersonsJson } from "./clients.helpers";
import {
  agentAssignmentSelectFields,
  mapAgentAssignmentsToApi,
  mergeAgentDisplayFromAssignments
} from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";

${slice(lines, 243, 882)}
`
);

const head = slice(lines, 1, 78);
const tailBeforeAudit = slice(lines, 883, 1256);
const tailAfterAudit = slice(lines, 1284, lines.length);

w(
  mainPath,
  `${head}
export * from "./clients.audit";
export * from "./clients.references";
export * from "./clients.list";
${tailBeforeAudit}
${tailAfterAudit}
`
);

console.log("Phase 18 clients split done.");
