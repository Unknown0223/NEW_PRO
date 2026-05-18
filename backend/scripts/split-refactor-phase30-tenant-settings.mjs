/**
 * v4 — tenant-settings.service bo‘linishi (tuzatilgan).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const mod = path.join(root, "../src/modules/tenant-settings");
const backup = path.join(mod, "tenant-settings.service.backup.ts");

function read(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function slice(lines, a, b) {
  return lines.slice(a - 1, b).join("\n");
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

const lines = read(backup);

w(
  path.join(mod, "tenant-settings.shared.ts"),
  `export function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}
`
);

w(
  path.join(mod, "tenant-settings.bonus.ts"),
  `import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  bonusPolicyToJson,
  mergeBonusStackPatch,
  parseBonusStackPolicy,
  type BonusStackJson,
  type BonusStackPolicy
} from "../orders/bonus-stack-policy";
import { asRecord } from "./tenant-settings.shared";

${slice(lines, 41, 85)}
`
);

w(path.join(mod, "tenant-settings.types.ts"), slice(lines, 87, 199));

let refsBody = slice(lines, 201, 522);
refsBody = refsBody
  .replace(/^function stringArrayFromUnknown/m, "export function stringArrayFromUnknown")
  .replace(/^function resolveRefusalReasonEntries/m, "export function resolveRefusalReasonEntries")
  .replace(/^function toClientRefEntryDto/m, "export function toClientRefEntryDto")
  .replace(/^function branchesFromUnknown/m, "export function branchesFromUnknown")
  .replace(/^async function assertBranchCashDeskAssignments/m, "export async function assertBranchCashDeskAssignments");
w(
  path.join(mod, "tenant-settings.refs.ts"),
  `import { prisma } from "../../config/database";
import { asRecord } from "./tenant-settings.shared";
import type {
  BranchDto,
  ClientRefEntryDto,
  TerritoryNodeDto,
  UnitMeasureDto
} from "./tenant-settings.types";
import { branchCashDeskIds } from "./tenant-settings.types";

${refsBody}
`
);

w(
  path.join(mod, "tenant-settings.territory.ts"),
  `import { asRecord } from "./tenant-settings.shared";
import type { CityTerritoryHintDto, TerritoryNodeDto } from "./tenant-settings.types";
import {
  stringArrayFromUnknown,
  territoryNodesFromUnknown,
  territoryTreeFromUnknown
} from "./tenant-settings.refs";
import {
  lalakuExpandRegionFilterTokens,
  normKeyTerritoryMatch
} from "../../../shared/territory-lalaku-seed";

${slice(lines, 524, 866)}
`
);

w(
  path.join(mod, "tenant-settings.profile.read.ts"),
  `import { prisma } from "../../config/database";
import { asRecord } from "./tenant-settings.shared";
import type { BranchDto, TenantProfileDto } from "./tenant-settings.types";
import type { PaymentMethodEntryDto } from "./finance-refs";
import {
  defaultCurrencyCodeFromEntries,
  paymentTypeStorageKeysFromMethodEntries,
  priceTypeEntriesFromUnknown,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "./finance-refs";
import {
  listActiveSalesChannelLabels,
  listActiveTradeDirectionLabels
} from "../sales-directions/sales-directions.service";
import {
  activeValuesFromClientRefEntries,
  branchesFromUnknown,
  clientRefEntriesFromUnknown,
  resolveRefusalReasonEntries,
  stringArrayFromUnknown,
  territoryNodesFromUnknown,
  territoryTreeFromUnknown,
  unitMeasuresFromUnknown
} from "./tenant-settings.refs";
import {
  referencesWithResolvedTerritoryNodes,
  territoryRegionPickerNames
} from "./tenant-settings.territory";

${slice(lines, 868, 990)}
`
);

w(
  path.join(mod, "tenant-settings.profile.patch.ts"),
  `import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { invalidatePriceTypesCache } from "../../lib/redis-cache";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { asRecord } from "./tenant-settings.shared";
import type {
  BranchDto,
  TerritoryNodeDto,
  TenantProfileDto,
  UnitMeasureDto
} from "./tenant-settings.types";
import type { CurrencyEntryDto, PaymentMethodEntryDto } from "./finance-refs";
import {
  defaultCurrencyCodeFromEntries,
  normalizeCurrencyDefaults,
  paymentTypeStorageKeysFromMethodEntries,
  resolveCurrencyEntries
} from "./finance-refs";
import {
  activeValuesFromClientRefEntries,
  assertBranchCashDeskAssignments,
  toClientRefEntryDto
} from "./tenant-settings.refs";
import { territoryRegionPickerNames } from "./tenant-settings.territory";
import { getTenantProfile } from "./tenant-settings.profile.read";

${slice(lines, 992, lines.length)}
`
);

w(
  path.join(mod, "tenant-settings.service.ts"),
  `/**
 * Domain: Tenant settings (profil, spravochniklar, bonus stack).
 */
export * from "./tenant-settings.shared";
export * from "./tenant-settings.bonus";
export * from "./tenant-settings.types";
export * from "./tenant-settings.refs";
export * from "./tenant-settings.territory";
export * from "./tenant-settings.profile.read";
export * from "./tenant-settings.profile.patch";
`
);

// Export patch-only types used in profile.patch signature (from refs slice)
let patch = fs.readFileSync(path.join(mod, "tenant-settings.profile.patch.ts"), "utf8");
if (!patch.includes("type ClientRefEntryPatch")) {
  const patchTypes = slice(lines, 324, 365);
  patch = patch.replace(
    'import { getTenantProfile } from "./tenant-settings.profile.read";',
    `import { getTenantProfile } from "./tenant-settings.profile.read";

${patchTypes}`
  );
  w(path.join(mod, "tenant-settings.profile.patch.ts"), patch);
}

// Export mapCashDeskIdToBranchName from refs
let refs = fs.readFileSync(path.join(mod, "tenant-settings.refs.ts"), "utf8");
if (!refs.includes("export async function mapCashDeskIdToBranchName")) {
  refs = refs.replace(
    /^export async function mapCashDeskIdToBranchName/m,
    "export async function mapCashDeskIdToBranchName"
  );
  refs = refs.replace(
    /^async function mapCashDeskIdToBranchName/m,
    "export async function mapCashDeskIdToBranchName"
  );
}
w(path.join(mod, "tenant-settings.refs.ts"), refs);

console.log("Phase 30 tenant-settings split done.");
