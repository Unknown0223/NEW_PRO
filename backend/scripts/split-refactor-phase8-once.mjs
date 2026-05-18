import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const staff = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/staff");
const src = path.join(staff, "staff.patches.web-presets.ts");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const storeHeader = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
`;

const apiHeader = `import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import { WEB_PANEL_STAFF_ROLES } from "../../lib/tenant-user-roles";
import {
  WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
  type WebStaffPositionPresetAdminDto,
  type WebStaffPositionPresetDto,
  activePresetLabels,
  enrichPresetsWithUserLabels,
  loadWebStaffPositionPresets,
  persistWebStaffPositionPresets,
  resolveWebStaffPresetsFromSettings
} from "./staff.patches.web-presets.store";
`;

const bulkHeader = `import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { WEB_PANEL_STAFF_ROLES } from "../../lib/tenant-user-roles";
`;

fs.writeFileSync(
  path.join(staff, "staff.patches.web-presets.store.ts"),
  `${storeHeader}
${slice(13, 240)}

export {
  WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
  WEB_STAFF_PRESET_MAX,
  type WebStaffPositionPresetDto,
  type WebStaffPositionPresetAdminDto,
  activePresetLabels,
  enrichPresetsWithUserLabels,
  loadWebStaffPositionPresets,
  persistWebStaffPositionPresets,
  resolveWebStaffPresetsFromSettings
};
`
);

// Export internal helpers used only within store file — re-export block adds exports for cross-file
let store = fs.readFileSync(path.join(staff, "staff.patches.web-presets.store.ts"), "utf8");
store = store
  .replace(/^async function enrichPresetsWithUserLabels/m, "export async function enrichPresetsWithUserLabels")
  .replace(/^async function persistWebStaffPositionPresets/m, "export async function persistWebStaffPositionPresets")
  .replace(/^async function resolveWebStaffPresetsFromSettings/m, "export async function resolveWebStaffPresetsFromSettings")
  .replace(/^async function loadWebStaffPositionPresets/m, "export async function loadWebStaffPositionPresets")
  .replace(/^function activePresetLabels/m, "export function activePresetLabels");
// Remove duplicate export block at end — we'll fix manually
store = store.replace(/\nexport \{\n[\s\S]*?\};\n?$/, "\n");
fs.writeFileSync(path.join(staff, "staff.patches.web-presets.store.ts"), store);

fs.writeFileSync(path.join(staff, "staff.patches.web-presets.api.ts"), `${apiHeader}\n${slice(243, 424)}\n`);

fs.writeFileSync(path.join(staff, "staff.patches.web-presets.bulk.ts"), `${bulkHeader}\n${slice(425, lines.length)}\n`);

fs.writeFileSync(
  path.join(staff, "staff.patches.web-presets.ts"),
  `/** Web panel presets + bulk session ops — barrel. */\nexport * from "./staff.patches.web-presets.store";\nexport * from "./staff.patches.web-presets.api";\nexport * from "./staff.patches.web-presets.bulk";\n`
);

console.log("phase8 web-presets split done");
