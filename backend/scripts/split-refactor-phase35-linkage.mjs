/**
 * v4 — linkage.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/linkage");
const mainPath = path.join(mod, "linkage.service.ts");
const backupPath = path.join(mod, "linkage.service.backup.ts");

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
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(mainPath, backupPath);
}

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
`;

const hdrTerritory = `${hdr}import { validateCheckin } from "../territory/territory.service";
`;

w(
  path.join(mod, "linkage.types.ts"),
  `${slice(lines, 11, 33)}

${slice(lines, 600, 607)}
`
);

let sharedBody = slice(lines, 35, 78);
sharedBody = sharedBody
  .replace(/^function parseEntitledProductIds/m, "export function parseEntitledProductIds")
  .replace(/^function intersectNumberSets/m, "export function intersectNumberSets");

w(path.join(mod, "linkage.shared.ts"), sharedBody);

function resolveFile(name, range, extra = "") {
  let body = slice(lines, range[0], range[1]);
  body = body.replace(/^async function resolveBy/m, "export async function resolveBy");
  w(
    path.join(mod, name),
    `${hdr}${extra}
${body}
`
  );
}

resolveFile("linkage.resolve.agent.ts", [80, 227], `import { parseEntitledProductIds } from "./linkage.shared";`);
resolveFile("linkage.resolve.warehouse.ts", [228, 336]);
resolveFile("linkage.resolve.cashdesk.ts", [337, 432]);
resolveFile("linkage.resolve.expeditor.ts", [433, 557]);

let territoryBody = `${slice(lines, 558, 599)}\n\n${slice(lines, 608, 677)}`;
territoryBody = territoryBody
  .replace(/^async function resolveTerritoryIdsForClient/m, "async function resolveTerritoryIdsForClient")
  .replace(/^async function listStaffUserIdsLinkedToTerritories/m, "async function listStaffUserIdsLinkedToTerritories")
  .replace(/^export async function getAgentPickerContextForAddress/m, "export async function getAgentPickerContextForAddress")
  .replace(/^async function mergeAgentsFromClientTerritories/m, "export async function mergeAgentsFromClientTerritories");

w(
  path.join(mod, "linkage.territory.ts"),
  `${hdrTerritory}import type { ClientAddressTerritoryInput } from "./linkage.types";

${territoryBody}
`
);

let clientBody = slice(lines, 679, 792);
clientBody = clientBody.replace(/^async function resolveByClient/m, "export async function resolveByClient");
w(
  path.join(mod, "linkage.resolve.client.ts"),
  `${hdr}import { mergeAgentsFromClientTerritories } from "./linkage.territory";

${clientBody}
`
);

w(
  path.join(mod, "linkage.scope.ts"),
  `${hdr}import type { LinkageConstraintScope, LinkageSelectedMasters } from "./linkage.types";
import { intersectNumberSets, normalizeSelectedId } from "./linkage.shared";
import { resolveByAgent } from "./linkage.resolve.agent";
import { resolveByCashDesk } from "./linkage.resolve.cashdesk";
import { resolveByClient } from "./linkage.resolve.client";
import { resolveByExpeditor } from "./linkage.resolve.expeditor";
import { resolveByWarehouse } from "./linkage.resolve.warehouse";

${slice(lines, 794, 882)}
`
);

w(
  path.join(mod, "linkage.service.ts"),
  `/**
 * Domain: Linkage (agent katalogi, filtr opsiyalari).
 */
export * from "./linkage.types";
export * from "./linkage.shared";
export * from "./linkage.resolve.agent";
export * from "./linkage.resolve.warehouse";
export * from "./linkage.resolve.cashdesk";
export * from "./linkage.resolve.expeditor";
export * from "./linkage.territory";
export * from "./linkage.resolve.client";
export * from "./linkage.scope";
`
);

console.log("Phase 35 linkage split done.");
