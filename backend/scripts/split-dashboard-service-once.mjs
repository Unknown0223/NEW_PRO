import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "../src/modules/dashboard");
const backup = path.join(dir, "dashboard.service.backup.ts");

if (!fs.existsSync(backup)) {
  fs.copyFileSync(path.join(dir, "dashboard.service.ts"), backup);
}

const lines = fs.readFileSync(backup, "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");
const header = slice(1, 14);

let helpers = slice(299, 348).replace(/^function /gm, "export function ");
helpers = helpers.replace(
  "return startOfTodayUtc().toISOString()",
  "return startOfTodayUtc().toISOString()"
);

fs.writeFileSync(
  path.join(dir, "dashboard.helpers.ts"),
  `${header}
import { startOfTodayUtc } from "./dashboard.cache";

${helpers}
`
);

let cacheBody = slice(15, 160);
cacheBody = cacheBody
  .replace(/^const DASHBOARD_CACHE_TTL = 30;[^\n]*\n/m, "")
  .replace(/^function cacheKey/m, "export function dashboardCacheKey")
  .replace(/^function stableJsonStringify/m, "export function stableJsonStringify")
  .replace(/^async function getSnapshotCache/m, "export async function getSnapshotCache")
  .replace(/^async function setSnapshotCache/m, "export async function setSnapshotCache")
  .replace(/^function startOfTodayUtc/m, "export function startOfTodayUtc")
  .replace(/^function endOfTodayUtc/m, "export function endOfTodayUtc")
  .replace(/cacheKey\(/g, "dashboardCacheKey(")
  .replace(
    /await redis\.set\(dashboardCacheKey\(tenantId\), JSON\.stringify\(result\), "EX", DASHBOARD_CACHE_TTL\);/,
    "await setSnapshotCache(dashboardCacheKey(tenantId), result);"
  );

fs.writeFileSync(path.join(dir, "dashboard.cache.ts"), `${header}\n${cacheBody}\n`);

const dashImports = `${header}
import {
  dashboardCacheKey,
  endOfTodayUtc,
  getSnapshotCache,
  setSnapshotCache,
  startOfTodayUtc,
  stableJsonStringify
} from "./dashboard.cache";
import {
  bigToNum,
  clampPct,
  csvToIntArray,
  csvToStringArray,
  decToString,
  nonEmpty,
  normalizeYmd
} from "./dashboard.helpers";
`;

fs.writeFileSync(
  path.join(dir, "dashboard.supervisor.ts"),
  `${dashImports}\n${slice(161, 298)}\n${slice(350, 1324)}`
);

let financeBody = slice(1325, 1891);
financeBody = financeBody
  .replace(/^function normalizeFromYmd/m, "export function normalizeFromYmd")
  .replace(/^function normalizeToYmd/m, "export function normalizeToYmd");
fs.writeFileSync(path.join(dir, "dashboard.finance.ts"), `${dashImports}\n${financeBody}\n`);

const salesHelpers = slice(1980, 2015).replace(/^function /gm, "export function ");
fs.writeFileSync(
  path.join(dir, "dashboard.sales.ts"),
  `${dashImports}
import { normalizeFromYmd, normalizeToYmd } from "./dashboard.finance";
${salesHelpers}

${slice(1892, 1979)}
${slice(2016, lines.length)}
`
);

fs.writeFileSync(
  path.join(dir, "dashboard.service.ts"),
  `/** Dashboard domain barrel. Rollback: dashboard.service.backup.ts */
export * from "./dashboard.cache";
export * from "./dashboard.helpers";
export * from "./dashboard.supervisor";
export * from "./dashboard.finance";
export * from "./dashboard.sales";
export * from "./sales-monitoring.service";
`
);

console.log("Dashboard split done.");
