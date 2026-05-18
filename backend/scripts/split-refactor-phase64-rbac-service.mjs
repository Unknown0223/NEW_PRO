/**
 * rbac.service bo‘linishi.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const mod = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/access");
const backupPath = path.join(mod, "rbac.service.backup.ts");
const srcPath = path.join(mod, "rbac.service.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}
function exportFns(body) {
  return body.replace(/^async function loadRolesByKeys/gm, "export async function loadRolesByKeys");
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = read(backupPath);

const hdr = slice(lines, 1, 4);

w(
  path.join(mod, "rbac.resolve.ts"),
  `${hdr}

${exportFns(slice(lines, 6, 158))}
`
);

w(
  path.join(mod, "rbac.access-manage.ts"),
  `${hdr}
import { loadRolesByKeys, type RoleWithPermKeys } from "./rbac.resolve";

${slice(lines, 160, 244)}
`
);

w(
  path.join(mod, "rbac.roles.ts"),
  `${hdr}

${slice(lines, 246, 311)}
`
);

w(
  path.join(mod, "rbac.permissions.ts"),
  `${hdr}

import {
  ACCESS_MANAGE_PERMISSION_KEY,
  AccessManageRequiredError,
  getUsersHaveAccessManage
} from "./rbac.access-manage";
import { derivePermissionModule } from "./rbac.resolve";

${slice(lines, 312, 479)}
`
);

w(
  path.join(mod, "rbac.service.ts"),
  `export * from "./rbac.resolve";
export * from "./rbac.access-manage";
export * from "./rbac.roles";
export * from "./rbac.permissions";
`
);

console.log("Phase 64 rbac.service split done.");
