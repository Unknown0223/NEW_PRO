#!/usr/bin/env node
/** client-edit-form: utils / map / tabs / hook. */
import fs, { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const formDir = path.join(root, "components/clients/client-edit");
const srcPath = path.join(root, "components/clients/client-edit-form.tsx");
const monolithPath = path.join(formDir, "client-edit-form.monolith.tsx");

mkdirSync(path.join(formDir, "hooks"), { recursive: true });
if (!fs.existsSync(monolithPath)) {
  copyFileSync(srcPath, monolithPath);
}
const lines = readFileSync(monolithPath, "utf8").split(/\r?\n/);

const imports = lines.slice(0, 32).join("\n");

function exp(block) {
  return block.replace(/^type /gm, "export type ").replace(/^function /gm, "export function ").replace(/^const /gm, "export const ");
}

writeFileSync(
  path.join(formDir, "client-edit-form.utils.ts"),
  `import type { ClientRow } from "@/lib/client-types";

${exp(lines.slice(33, 136).join("\n"))}
`
);

writeFileSync(
  path.join(formDir, "client-edit-form-ui.tsx"),
  `"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

${exp(lines.slice(137, 177).join("\n"))}
`
);

writeFileSync(
  path.join(formDir, "yandex-coordinate-picker.tsx"),
  `"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { MAP_DEFAULT_LAT, MAP_DEFAULT_LON, normalizeCoord } from "./client-edit-form.utils";

${lines.slice(178, 446).join("\n").replace(/^function YandexCoordinatePicker/, "export function YandexCoordinatePicker")}
`
);

// hook: component body without JSX return (458-1165 approx - need to find return)
const returnLine = lines.findIndex((l, i) => i > 1100 && l.trim().startsWith("return ("));
const hookStart = 465; // inside export function
const hookEnd = returnLine > 0 ? returnLine : 1165;

writeFileSync(
  path.join(formDir, "hooks/use-client-edit-form.ts"),
  `"use client";

${imports}
import { invalidateClientAuditQueries } from "@/lib/client-audit-history";
import { STALE } from "@/lib/query-stale";
import { useFormIntentTracking } from "@/lib/activity-tracker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pickCityTerritoryHint } from "@/lib/city-territory-hint";
import { mergeRefOptions } from "@/lib/merge-ref-options";
import { mergeRefSelectOptions } from "@/lib/ref-select-options";
import { orderAgentFilterOption, orderExpeditorFilterOption } from "@/lib/order-picker-labels";
import {
  type ClientDetailApi,
  type AgentSlotForm,
  isoToDateInput,
  pinflForApi,
  emptyAgentSlot,
  buildAgentSlots,
  toggleWeekday,
  dateInputToIso,
  parseCoordsFromLocationText,
  normalizeCoord,
  inLatRange,
  inLonRange,
  MAX_TEAM_ROWS,
  VISIT_DAYS
} from "../client-edit-form.utils";
import { agentAssignmentsFieldHint } from "../client-edit-form-ui";

export type ClientEditFormVm = ReturnType<typeof useClientEditForm>;

export function useClientEditForm({
  tenantSlug,
  clientId,
  mode = "edit",
  onSuccess,
  onCancel,
  redirectOnSuccess = true
}: {
  tenantSlug: string | null;
  clientId?: number;
  mode?: "edit" | "create";
  onSuccess: (clientId: number) => void;
  onCancel: () => void;
  redirectOnSuccess?: boolean;
}) {
${lines.slice(hookStart, hookEnd).join("\n")}
}
`
);

writeFileSync(
  path.join(formDir, "client-edit-form-main-tab.tsx"),
  `"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { AssignmentLockPanel } from "@/components/work-slots/assignment-lock-panel";
import { cn } from "@/lib/utils";
import { emptyAgentSlot, MAX_TEAM_ROWS, toggleWeekday, VISIT_DAYS } from "./client-edit-form.utils";
import { Caption, FieldHint, SpravochnikAdminLink } from "./client-edit-form-ui";
import { YandexCoordinatePicker } from "./yandex-coordinate-picker";
import type { ClientEditFormVm } from "./hooks/use-client-edit-form";

export function ClientEditFormMainTab({ vm }: { vm: ClientEditFormVm }) {
  const {
    tab,
    mutation,
    inputCls,
    selectCls,
    name, setName,
    legalName, setLegalName,
    address, setAddress,
    landmark, setLandmark,
    phone, setPhone,
    clientCode, setClientCode,
    responsiblePerson, setResponsiblePerson,
    isActive, setIsActive,
    notes, setNotes,
    fieldErrors,
    catOpts, typeOpts, formatOpts,
    category, setCategory,
    clientTypeCode, setClientTypeCode,
    clientFormat, setClientFormat,
    region, onRegionSelect,
    city, onCitySelect,
    zone, onZoneSelect,
    terrOpts, cascadedCityOpts, cascadedZoneOpts,
    street, setStreet,
    houseNumber, setHouseNumber,
    apartment, setApartment,
    gpsText, setGpsText,
    mapSearchText, setMapSearchText,
    mapSearchPending,
    handleMapSearch,
    mapSearchNotice,
    mapOk, latParsed, lonParsed,
    applyPickedCoords,
    latitude, setLatitude,
    longitude, setLongitude,
    setMapSearchNotice,
    yandexMapsHref,
    agentSlots, setAgentSlots,
    agentTeamSelectOptions,
    expeditorTeamSelectOptions,
    agentsPickerQ,
    expeditorsPickerQ,
    territoryAgentPickerCtxQ,
    isCreateMode,
    slot1LockType, setSlot1LockType,
    slot1LockReason, setSlot1LockReason
  } = vm;

  if (tab !== "main") return null;

  return (
${lines.slice(1249, 1746).join("\n")}
  );
}
`
);

writeFileSync(
  path.join(formDir, "client-edit-form-extra-tab.tsx"),
  `"use client";

import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { Caption, FieldHint, SpravochnikAdminLink } from "./client-edit-form-ui";
import type { ClientEditFormVm } from "./hooks/use-client-edit-form";

export function ClientEditFormExtraTab({ vm }: { vm: ClientEditFormVm }) {
  const {
    tab,
    mutation,
    selectCls,
    productCategoryRef, setProductCategoryRef,
    salesChannel, setSalesChannel,
    prodCatOpts, salesOpts,
    creditLimit, setCreditLimit,
    logisticsService, setLogisticsService,
    logisticsOpts,
    licenseUntil, setLicenseUntil,
    workingHours, setWorkingHours,
    inn, setInn,
    pdl, setPdl,
    bankName, setBankName,
    bankAccount, setBankAccount,
    bankMfo, setBankMfo,
    clientPinfl, setClientPinfl,
    oked, setOked,
    contractNumber, setContractNumber,
    vatRegCode, setVatRegCode,
    fieldErrors
  } = vm;

  if (tab !== "extra") return null;

  return (
${lines.slice(1748, lines.length - 1).join("\n").replace(/\)\s*;\s*$/, "").trim()}
  );
}
`
);

// Find shell lines (header, tabs, footer) - between return and main tab
const shellBefore = lines.slice(returnLine, 1248).join("\n");
const shellAfter = lines.slice(1746, 1748).join("\n"); // closing main tab - actually 1747 is `)}`

writeFileSync(
  path.join(formDir, "client-edit-form-view.tsx"),
  `"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";
import { ClientEditFormExtraTab } from "./client-edit-form-extra-tab";
import { ClientEditFormMainTab } from "./client-edit-form-main-tab";
import { useClientEditForm } from "./hooks/use-client-edit-form";

export function ClientEditForm(props: Parameters<typeof useClientEditForm>[0]) {
  const vm = useClientEditForm(props);

  return (
${shellBefore}
      <ClientEditFormMainTab vm={vm} />
${shellAfter}
      <ClientEditFormExtraTab vm={vm} />
    </form>
  );
}
`
);

writeFileSync(
  path.join(root, "components/clients/client-edit-form.tsx"),
  `"use client";

export { ClientEditForm } from "./client-edit/client-edit-form-view";
`
);

for (const f of [
  "client-edit-form.utils.ts",
  "client-edit-form-ui.tsx",
  "yandex-coordinate-picker.tsx",
  "hooks/use-client-edit-form.ts",
  "client-edit-form-main-tab.tsx",
  "client-edit-form-extra-tab.tsx",
  "client-edit-form-view.tsx"
]) {
  const p = path.join(formDir, f);
  console.log(`${f}\t${readFileSync(p, "utf8").split(/\n/).length}`);
}
