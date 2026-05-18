import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");
const lines = fs.readFileSync(path.join(dir, "staff.service.backup.ts"), "utf8").split(/\r?\n/);

function slice(a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(name, c) {
  fs.writeFileSync(path.join(dir, name), c.endsWith("\n") ? c : `${c}\n`);
}

const header = slice(1, 26);

w(
  "staff.shared.types.ts",
  `${header}
${slice(28, 192)}
`
);

w(
  "staff.shared.helpers.ts",
  `${header}
import type { AgentEntitlements, ExpeditorAssignmentRules, StaffKind } from "./staff.shared.types";
import { SKLADCHIK_WAREHOUSE_LINK_ROLE } from "./staff.shared.types";
import {
  parseMobileConfigV1,
  validateAgentMobileConfig
} from "./agent-mobile-config";
import {
  assertValidEntitlementsKeys,
  normalizeWarehouseStaffEntitlementsRow
} from "./skladchik-entitlements";

${slice(194, 492)}
`
);

w(
  "staff.shared.filters.ts",
  `import { prisma } from "../../config/database";
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";

${slice(494, 747)}
`
);

w(
  "staff.shared.ts",
  `/** Staff shared — barrel. */
export * from "./staff.shared.types";
export * from "./staff.shared.helpers";
export * from "./staff.shared.filters";
`
);

console.log("ok");
