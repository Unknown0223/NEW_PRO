import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");

function read(name) {
  return fs.readFileSync(path.join(dir, name), "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function write(name, c) {
  fs.writeFileSync(path.join(dir, name), c.endsWith("\n") ? c : `${c}\n`);
}

// --- staff.shared ---
const sh = read("staff.shared.ts");
const sharedTypesHeader = slice(sh, 1, 26);

write(
  "staff.shared.types.ts",
  `${sharedTypesHeader}
${slice(sh, 28, 192)}
`
);

const helpersHeader = `${sharedTypesHeader}
import type {
  AgentEntitlements,
  ExpeditorAssignmentRules,
  StaffKind
} from "./staff.shared.types";
import {
  parseMobileConfigV1,
  validateAgentMobileConfig
} from "./agent-mobile-config";
import {
  assertValidEntitlementsKeys,
  normalizeWarehouseStaffEntitlementsRow
} from "./skladchik-entitlements";
`;

write(
  "staff.shared.helpers.ts",
  `${helpersHeader}
${slice(sh, 194, 492)}
`
);

const filtersHeader = `${sharedTypesHeader}
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";
import { refStringListFromTenantSettings } from "./staff.shared.helpers";
`;

write(
  "staff.shared.filters.ts",
  `${filtersHeader}
${slice(sh, 494, sh.length)}
`
);

write(
  "staff.shared.ts",
  `/** Staff shared types, parsers, filter options — barrel. */
export * from "./staff.shared.types";
export * from "./staff.shared.helpers";
export * from "./staff.shared.filters";
`
);

// --- staff.crud ---
const cr = read("staff.crud.ts");
const crHeader = slice(cr, 1, 58);

write(
  "staff.crud.list.ts",
  `${crHeader}
${slice(cr, 61, 299)}
`
);

write(
  "staff.crud.patch.ts",
  `${crHeader}
import { listStaff } from "./staff.crud.list";

${slice(cr, 301, 349)}
${slice(cr, 676, cr.length)}
`
);

write(
  "staff.crud.create.ts",
  `${crHeader}
import { listStaff } from "./staff.crud.list";

${slice(cr, 351, 675)}
`
);

write(
  "staff.crud.ts",
  `/** Staff CRUD — barrel. */
export * from "./staff.crud.list";
export * from "./staff.crud.create";
export * from "./staff.crud.patch";
`
);

console.log("staff phase6 done");
