import type { WorkSlotType } from "@/lib/work-slots-types";
import type { BulkFieldMode } from "./work-slots-bulk-field";
import {
  buildBindingsPatchFromBulk,
  buildTerritoryPatchFromBulk,
  validateBulkBindingsSet,
  validateBulkTerritorySet,
  type WorkSlotsLocationBulkModes,
  type WorkSlotsLocationValues
} from "./work-slots-location-fields";

/** Поля групповой обработки — видимость по роли места. */
export type WorkSlotsBulkFieldKey =
  | "is_active"
  | "branch_code"
  | "direction_id"
  | "label"
  | "slot_type"
  | "territory"
  | "warehouse_id"
  | "return_warehouse_id"
  | "cash_desk_id";

export type WorkSlotsBulkDestructiveAction = "unassign" | "delete";

const SLOT_LEVEL: WorkSlotsBulkFieldKey[] = ["is_active", "branch_code", "label"];

export function bulkFieldsForSlotType(slotType: WorkSlotType): WorkSlotsBulkFieldKey[] {
  switch (slotType) {
    case "agent":
      return [
        ...SLOT_LEVEL,
        "direction_id",
        "slot_type",
        "territory",
        "warehouse_id",
        "return_warehouse_id",
        "cash_desk_id"
      ];
    case "expeditor":
      return [
        ...SLOT_LEVEL,
        "direction_id",
        "territory",
        "warehouse_id",
        "return_warehouse_id",
        "cash_desk_id"
      ];
    case "collector":
      return [...SLOT_LEVEL, "cash_desk_id"];
    case "skladchik":
      return [...SLOT_LEVEL, "territory", "warehouse_id", "return_warehouse_id"];
    case "supervisor":
      return [...SLOT_LEVEL];
    case "auditor":
      return [...SLOT_LEVEL, "territory", "warehouse_id", "cash_desk_id"];
    default:
      return [...SLOT_LEVEL];
  }
}

export function bulkDestructiveActionsForSlotType(_slotType: WorkSlotType): WorkSlotsBulkDestructiveAction[] {
  return ["unassign", "delete"];
}

export type WorkSlotsBulkFormModes = {
  isActive: BulkFieldMode;
  branchCode: BulkFieldMode;
  directionId: BulkFieldMode;
  label: BulkFieldMode;
  slotType: BulkFieldMode;
};

export const EMPTY_BULK_FORM_MODES = (): WorkSlotsBulkFormModes => ({
  isActive: "keep",
  branchCode: "keep",
  directionId: "keep",
  label: "keep",
  slotType: "keep"
});

export type WorkSlotsBulkFormValues = {
  isActive: boolean;
  branchCodeList: string[];
  directionId: string;
  label: string;
  slotType: WorkSlotType;
};

export function countBulkFormChanges(
  fields: WorkSlotsBulkFieldKey[],
  modes: WorkSlotsBulkFormModes,
  locationModes: WorkSlotsLocationBulkModes
): number {
  let n = 0;
  if (fields.includes("is_active") && modes.isActive !== "keep") n += 1;
  if (fields.includes("branch_code") && modes.branchCode !== "keep") n += 1;
  if (fields.includes("direction_id") && modes.directionId !== "keep") n += 1;
  if (fields.includes("label") && modes.label !== "keep") n += 1;
  if (fields.includes("slot_type") && modes.slotType !== "keep") n += 1;
  if (fields.includes("territory")) {
    n += [locationModes.territoryZone, locationModes.territoryOblast, locationModes.territoryCity].filter(
      (m) => m !== "keep"
    ).length;
  }
  if (fields.includes("warehouse_id") && locationModes.warehouseId !== "keep") n += 1;
  if (fields.includes("return_warehouse_id") && locationModes.returnWarehouseId !== "keep") n += 1;
  if (fields.includes("cash_desk_id") && locationModes.cashDeskId !== "keep") n += 1;
  return n;
}

export function validateBulkForm(
  fields: WorkSlotsBulkFieldKey[],
  modes: WorkSlotsBulkFormModes,
  values: WorkSlotsBulkFormValues,
  location: WorkSlotsLocationValues,
  locationModes: WorkSlotsLocationBulkModes
): string | null {
  if (fields.includes("branch_code") && modes.branchCode === "set" && values.branchCodeList.length === 0) {
    return "Филиал: выберите хотя бы одно значение";
  }
  if (fields.includes("direction_id") && modes.directionId === "set" && !values.directionId.trim()) {
    return "Направление: выберите значение";
  }
  if (fields.includes("label") && modes.label === "set" && !values.label.trim()) {
    return "Название: введите значение";
  }
  if (fields.includes("territory")) {
    const err = validateBulkTerritorySet(location, locationModes);
    if (err) return err;
  }
  if (fields.includes("warehouse_id") || fields.includes("cash_desk_id")) {
    const err = validateBulkBindingsSet(location, locationModes);
    if (err) return err;
  }
  return null;
}

export function buildBulkRequestBody(
  selectedIds: number[],
  fields: WorkSlotsBulkFieldKey[],
  modes: WorkSlotsBulkFormModes,
  values: WorkSlotsBulkFormValues,
  location: WorkSlotsLocationValues,
  locationModes: WorkSlotsLocationBulkModes,
  destructive: WorkSlotsBulkDestructiveAction | null
): Record<string, unknown> {
  const body: Record<string, unknown> = { slot_ids: selectedIds };

  if (destructive === "delete") {
    body.delete = true;
    return body;
  }
  if (destructive === "unassign") {
    body.unassign = true;
    return body;
  }

  if (fields.includes("is_active") && modes.isActive === "set") {
    body.is_active = values.isActive;
  }

  if (fields.includes("branch_code")) {
    if (modes.branchCode === "clear") body.branch_code = null;
    else if (modes.branchCode === "set") {
      const codes = values.branchCodeList.map((c) => c.trim()).filter(Boolean);
      if (codes.length > 1) body.branch_codes = codes;
      else if (codes.length === 1) body.branch_code = codes[0];
      else body.branch_code = null;
    }
  }

  if (fields.includes("direction_id")) {
    if (modes.directionId === "clear") body.direction_id = null;
    else if (modes.directionId === "set") {
      body.direction_id = values.directionId.trim()
        ? Number.parseInt(values.directionId.trim(), 10)
        : null;
    }
  }

  if (fields.includes("label")) {
    if (modes.label === "clear") body.label = null;
    else if (modes.label === "set") body.label = values.label.trim() || null;
  }

  if (fields.includes("slot_type") && modes.slotType === "set") {
    body.slot_type = values.slotType;
  }

  const territoryFields = fields.includes("territory");
  const bindingFields =
    fields.includes("warehouse_id") ||
    fields.includes("return_warehouse_id") ||
    fields.includes("cash_desk_id");

  if (territoryFields) {
    Object.assign(body, buildTerritoryPatchFromBulk(location, locationModes));
  }

  if (bindingFields) {
    const bindingsPatch = buildBindingsPatchFromBulk(location, locationModes);
    if (!fields.includes("warehouse_id") || locationModes.warehouseId === "keep") {
      delete bindingsPatch.warehouse_id;
    }
    if (!fields.includes("return_warehouse_id") || locationModes.returnWarehouseId === "keep") {
      delete bindingsPatch.return_warehouse_id;
    }
    if (!fields.includes("cash_desk_id") || locationModes.cashDeskId === "keep") {
      delete bindingsPatch.cash_desk_id;
    }
    Object.assign(body, bindingsPatch);
  }

  return body;
}
