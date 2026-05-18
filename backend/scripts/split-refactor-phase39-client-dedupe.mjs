/**
 * v4 — client-dedupe.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/clients");
const mainPath = path.join(mod, "client-dedupe.service.ts");
const backupPath = path.join(mod, "client-dedupe.service.backup.ts");

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
`;

w(path.join(mod, "client-dedupe.types.ts"), slice(lines, 4, 74));

w(
  path.join(mod, "client-dedupe.constants.ts"),
  `export const MAX_GROUPS = 5000;
export const MAX_IDS_PER_GROUP = 40;
export const DEFAULT_SEARCH_FIELDS = ["name", "legal_name"];
`
);

let helpersBody = slice(lines, 81, 117);
helpersBody = helpersBody.replace(/^function /gm, "export function ");
w(
  path.join(mod, "client-dedupe.helpers.ts"),
  `${hdr}import { DEFAULT_SEARCH_FIELDS } from "./client-dedupe.constants";

${helpersBody.replace("DEFAULT_SEARCH_FIELDS = [\"name\", \"legal_name\"];", "").replace(/const DEFAULT_SEARCH_FIELDS[^\n]+\n/, "")}
`
);

// Remove duplicate DEFAULT_SEARCH_FIELDS from helpers if copied
let helpersFixed = slice(lines, 81, 117);
helpersFixed = helpersFixed
  .replace(/^const DEFAULT_SEARCH_FIELDS[^\n]+\n\n/, "")
  .replace(/^function /gm, "export function ");
w(
  path.join(mod, "client-dedupe.helpers.ts"),
  `${hdr}import { DEFAULT_SEARCH_FIELDS } from "./client-dedupe.constants";

${helpersFixed}
`
);

let sqlBody = slice(lines, 119, 159).replace(/^function clientWhereFragment/, "export function clientWhereFragment");
w(
  path.join(mod, "client-dedupe.sql.ts"),
  `${hdr}import type { DuplicateCandidatesQuery } from "./client-dedupe.types";
import { normalizeSearchFields } from "./client-dedupe.helpers";

${sqlBody}
`
);

w(
  path.join(mod, "client-dedupe.preview.ts"),
  `${hdr}import type { ClientDedupePreviewDto } from "./client-dedupe.types";
import { formatBalanceUZS, formatContactPersonsSummary, formatMoneyUZS } from "./client-dedupe.helpers";

type PreviewAgg = {
  orders_total: number;
  orders_open: number;
  orders_cancelled: number;
  bonus_sum: Prisma.Decimal;
};

${slice(lines, 168, 268)}

${slice(lines, 270, 373)}
`
);

w(
  path.join(mod, "client-dedupe.candidates.ts"),
  `${hdr}import type { ClientDedupePreviewDto, DuplicateCandidatesQuery, DuplicateGroupDto, DuplicateTab } from "./client-dedupe.types";
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

${slice(lines, 383, 519)}
`
);

w(
  path.join(mod, "client-dedupe.history.ts"),
  `${hdr}
${slice(lines, 521, 659)}
`
);

w(
  path.join(mod, "client-dedupe.saved.ts"),
  `${hdr}
${slice(lines, 661, 719)}
`
);

w(
  path.join(mod, "client-dedupe.service.ts"),
  `/**
 * Domain: client duplicate detection and saved groups.
 */
export * from "./client-dedupe.types";
export * from "./client-dedupe.constants";
export * from "./client-dedupe.helpers";
export * from "./client-dedupe.sql";
export * from "./client-dedupe.preview";
export * from "./client-dedupe.candidates";
export * from "./client-dedupe.history";
export * from "./client-dedupe.saved";
`
);

console.log("Phase 39 client-dedupe split done.");
