import type { WorkSlotType } from "@/lib/work-slots-types";
import { isValidMaxSessionsValue } from "@/lib/max-sessions";
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
  | "max_sessions"
  | "territory"
  | "warehouse_id"
  | "return_warehouse_id"
  | "cash_desk_id";

export type WorkSlotsBulkDestructiveAction = "unassign" | "delete" | "revoke_sessions";

const BASE: WorkSlotsBulkFieldKey[] = ["is_active", "branch_code", "label", "max_sessions"];

/**
 * Rol bo‘yicha guruhli bog‘lanishlar (bitta manba).
 * Asosiy: filial/status/nom — hammaga.
 * Hudud/ombor/kassa/yo‘nalish — rol vazifasiga qarab.
 *
 * Web-rollar (operator / director / …) avval faqat BASE edi — joy to‘liq
 * shakllanmas edi; endi har bir rol o‘z bog‘lanishlariga ega.
 */
export function bulkFieldsForSlotType(slotType: WorkSlotType): WorkSlotsBulkFieldKey[] {
  switch (slotType) {
    case "agent":
      return [
        ...BASE,
        "direction_id",
        "slot_type",
        "territory",
        "warehouse_id",
        "return_warehouse_id",
        "cash_desk_id"
      ];
    case "expeditor":
      return [
        ...BASE,
        "direction_id",
        "territory",
        "warehouse_id",
        "return_warehouse_id",
        "cash_desk_id"
      ];
    case "collector":
      return [...BASE, "territory", "cash_desk_id"];
    case "skladchik":
      return [...BASE, "territory", "warehouse_id", "return_warehouse_id"];
    case "supervisor":
      return [...BASE, "direction_id", "territory", "warehouse_id"];
    case "auditor":
      return [...BASE, "direction_id", "territory", "warehouse_id", "cash_desk_id"];
    case "operator":
      return [...BASE, "direction_id", "territory", "warehouse_id", "cash_desk_id"];
    case "director":
      return [
        ...BASE,
        "direction_id",
        "territory",
        "warehouse_id",
        "return_warehouse_id",
        "cash_desk_id"
      ];
    case "sales_director":
      return [...BASE, "direction_id", "territory", "warehouse_id"];
    case "manager":
      return [...BASE, "direction_id", "territory", "warehouse_id", "cash_desk_id"];
    case "regional_manager":
      return [...BASE, "direction_id", "territory", "warehouse_id"];
    case "accountant":
      return [...BASE, "territory", "cash_desk_id"];
    case "warehouse_manager":
      return [...BASE, "direction_id", "territory", "warehouse_id", "return_warehouse_id"];
    default:
      return [...BASE, "direction_id", "territory"];
  }
}

/** Edit / create joy formasi — ombor/kassa ko‘rinishi (bulk bilan bir xil manba). */
export function slotLocationBindingFields(
  slotType: WorkSlotType | string | undefined
): Array<"warehouse" | "return_warehouse" | "cash_desk"> {
  if (!slotType) return ["warehouse", "cash_desk"];
  const fields = bulkFieldsForSlotType(slotType as WorkSlotType);
  const out: Array<"warehouse" | "return_warehouse" | "cash_desk"> = [];
  if (fields.includes("warehouse_id")) out.push("warehouse");
  if (fields.includes("return_warehouse_id")) out.push("return_warehouse");
  if (fields.includes("cash_desk_id")) out.push("cash_desk");
  return out;
}

export function slotSupportsTerritory(slotType: WorkSlotType | string | undefined): boolean {
  if (!slotType) return true;
  return bulkFieldsForSlotType(slotType as WorkSlotType).includes("territory");
}

export function slotSupportsDirection(slotType: WorkSlotType | string | undefined): boolean {
  if (!slotType) return true;
  return bulkFieldsForSlotType(slotType as WorkSlotType).includes("direction_id");
}

export function bulkDestructiveActionsForSlotType(_slotType: WorkSlotType): WorkSlotsBulkDestructiveAction[] {
  return ["unassign", "revoke_sessions", "delete"];
}

/** «Очистить» ma’nosiz bo‘lgan maydonlar (boolean / majburiy enum). */
export function bulkFieldAllowsClear(field: WorkSlotsBulkFieldKey): boolean {
  return field !== "is_active" && field !== "slot_type" && field !== "max_sessions";
}

export type WorkSlotsBulkFormModes = {
  isActive: BulkFieldMode;
  branchCode: BulkFieldMode;
  directionId: BulkFieldMode;
  label: BulkFieldMode;
  slotType: BulkFieldMode;
  maxSessions: BulkFieldMode;
};

export const EMPTY_BULK_FORM_MODES = (): WorkSlotsBulkFormModes => ({
  isActive: "keep",
  branchCode: "keep",
  directionId: "keep",
  label: "keep",
  slotType: "keep",
  maxSessions: "keep"
});

export type WorkSlotsBulkFormValues = {
  isActive: boolean;
  branchCodeList: string[];
  directionId: string;
  label: string;
  slotType: WorkSlotType;
  maxSessions: number;
};

export function countBulkFormChanges(
  fields: WorkSlotsBulkFieldKey[],
  modes: WorkSlotsBulkFormModes,
  locationModes: WorkSlotsLocationBulkModes
): number {
  let n = 0;
  if (fields.includes("is_active") && modes.isActive === "set") n += 1;
  if (fields.includes("branch_code") && modes.branchCode !== "keep") n += 1;
  if (fields.includes("direction_id") && modes.directionId !== "keep") n += 1;
  if (fields.includes("label") && modes.label !== "keep") n += 1;
  if (fields.includes("slot_type") && modes.slotType === "set") n += 1;
  if (fields.includes("max_sessions") && modes.maxSessions === "set") n += 1;
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
  if (fields.includes("max_sessions") && modes.maxSessions === "set") {
    const n = values.maxSessions;
    if (!isValidMaxSessionsValue(n)) {
      return "Максимум сессий: 1–99 или неограниченно";
    }
  }
  if (fields.includes("territory")) {
    const err = validateBulkTerritorySet(location, locationModes);
    if (err) return err;
  }
  if (
    fields.includes("warehouse_id") ||
    fields.includes("return_warehouse_id") ||
    fields.includes("cash_desk_id")
  ) {
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
  if (destructive === "revoke_sessions") {
    body.revoke_sessions = true;
    return body;
  }

  if (fields.includes("is_active") && modes.isActive === "set") {
    body.is_active = values.isActive;
  }

  if (fields.includes("branch_code")) {
    if (modes.branchCode === "clear") body.branch_code = null;
    else if (modes.branchCode === "set") {
      const codes = values.branchCodeList.map((c) => c.trim()).filter(Boolean);
      if (codes.length > 0) body.branch_codes = codes;
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

  if (fields.includes("max_sessions") && modes.maxSessions === "set") {
    body.max_sessions = values.maxSessions;
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
      delete bindingsPatch.warehouse_ids;
    }
    if (!fields.includes("return_warehouse_id") || locationModes.returnWarehouseId === "keep") {
      delete bindingsPatch.return_warehouse_id;
    }
    if (!fields.includes("cash_desk_id") || locationModes.cashDeskId === "keep") {
      delete bindingsPatch.cash_desk_id;
      delete bindingsPatch.cash_desk_ids;
    }
    Object.assign(body, bindingsPatch);
  }

  return body;
}
