"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import type { WorkSlotType } from "@/lib/work-slots-types";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { cn } from "@/lib/utils";
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { SLOT_TYPE_OPTIONS } from "./work-slots-utils";
import {
  EMPTY_LOCATION_BULK_MODES,
  WorkSlotsLocationFields,
  buildBindingsPatchFromBulk,
  buildTerritoryPatchFromBulk,
  countBulkBindingsChanges,
  countBulkTerritoryChanges,
  validateBulkBindingsSet,
  validateBulkTerritorySet,
  type WorkSlotsLocationBulkModes,
  type WorkSlotsLocationValues
} from "./work-slots-location-fields";

export type WorkSlotsBulkAction =
  | "is_active"
  | "branch_code"
  | "slot_type"
  | "active_user_territory"
  | "active_user_bindings"
  | "delete";

export type WorkSlotsBulkResult = {
  updated?: number;
  deleted?: number;
  users_updated?: number;
  skipped_no_user?: number;
};

const ACTION_LABELS: Record<WorkSlotsBulkAction, string> = {
  is_active: "Статус (активное / неактивное)",
  branch_code: "Филиал места",
  slot_type: "Роль места",
  active_user_territory: "Территория сотрудника",
  active_user_bindings: "Привязки сотрудника (склад, касса)",
  delete: "Удалить места"
};

type PickerOpt = { id: number; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  selectedIds: number[];
  branchOptions: string[];
  territoryCascade: {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  onDone: (result: WorkSlotsBulkResult) => void;
};

export function WorkSlotsBulkDialog({
  open,
  onOpenChange,
  tenant,
  selectedIds,
  branchOptions,
  territoryCascade,
  warehouses,
  cashDesks,
  onDone
}: Props) {
  const [action, setAction] = useState<WorkSlotsBulkAction>("is_active");
  const [isActive, setIsActive] = useState(true);
  const [branchCodeList, setBranchCodeList] = useState<string[]>([]);
  const [slotType, setSlotType] = useState<WorkSlotType>("agent");
  const [saving, setSaving] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [location, setLocation] = useState<WorkSlotsLocationValues>({
    territoryZone: "",
    territoryOblast: "",
    territoryCity: "",
    territoryZoneList: [],
    territoryOblastList: [],
    territoryCityList: [],
    warehouseId: null,
    cashDeskId: null
  });
  const [locationModes, setLocationModes] = useState<WorkSlotsLocationBulkModes>(EMPTY_LOCATION_BULK_MODES);
  const [error, setError] = useState<string | null>(null);

  const territoryChangeCount = useMemo(
    () => countBulkTerritoryChanges(locationModes),
    [locationModes]
  );
  const bindingsChangeCount = useMemo(
    () => countBulkBindingsChanges(locationModes),
    [locationModes]
  );

  useEffect(() => {
    if (!open) return;
    setAction("is_active");
    setIsActive(true);
    setBranchCodeList([]);
    setSlotType("agent");
    setDeleteConfirmed(false);
    setLocation({
      territoryZone: "",
      territoryOblast: "",
      territoryCity: "",
      territoryZoneList: [],
      territoryOblastList: [],
      territoryCityList: [],
      warehouseId: null,
      cashDeskId: null
    });
    setLocationModes(EMPTY_LOCATION_BULK_MODES());
    setError(null);
  }, [open]);

  const submit = async () => {
    if (!selectedIds.length) return;
    if (action === "delete" && !deleteConfirmed) {
      setError("Подтвердите удаление");
      return;
    }

    const body: Record<string, unknown> = { slot_ids: selectedIds };

    if (action === "delete") {
      body.delete = true;
    } else if (action === "is_active") {
      body.is_active = isActive;
    } else if (action === "branch_code") {
      const codes = branchCodeList.map((c) => c.trim()).filter(Boolean);
      if (codes.length > 1) body.branch_codes = codes;
      else if (codes.length === 1) body.branch_code = codes[0];
      else body.branch_code = null;
    } else if (action === "slot_type") {
      body.slot_type = slotType;
    } else if (action === "active_user_territory") {
      const locationError = validateBulkTerritorySet(location, locationModes);
      if (locationError) {
        setError(locationError);
        return;
      }
      const patch = buildTerritoryPatchFromBulk(location, locationModes);
      if (Object.keys(patch).length === 0) {
        setError("Укажите зону, область или город: «Очистить» или «Задать»");
        return;
      }
      Object.assign(body, patch);
    } else if (action === "active_user_bindings") {
      const locationError = validateBulkBindingsSet(location, locationModes);
      if (locationError) {
        setError(locationError);
        return;
      }
      const patch = buildBindingsPatchFromBulk(location, locationModes);
      if (Object.keys(patch).length === 0) {
        setError("Укажите склад или кассу: «Очистить» или «Задать»");
        return;
      }
      Object.assign(body, patch);
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: WorkSlotsBulkResult }>(`/api/${tenant}/work-slots/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      onOpenChange(false);
      onDone(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось выполнить");
    } finally {
      setSaving(false);
    }
  };

  const isDelete = action === "delete";
  const isTerritory = action === "active_user_territory";
  const isBindings = action === "active_user_bindings";
  const isEmployeePatch = isTerritory || isBindings;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,920px)] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none",
          isEmployeePatch
            ? "sm:w-[min(40rem,calc(100vw-2rem))] sm:max-w-[min(40rem,calc(100vw-2rem))]"
            : "sm:w-[min(32rem,calc(100vw-2rem))] sm:max-w-lg"
        )}
      >
        <DialogHeader className="space-y-3 border-b bg-muted/25 px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-6">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Layers3 className="size-5 text-muted-foreground" aria-hidden />
                Групповая обработка
              </DialogTitle>
              <DialogDescription className="text-sm">
                Одно действие применяется ко всем выбранным рабочим местам на текущей странице.
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 text-sm font-normal tabular-nums">
              {selectedIds.length} мест
            </Badge>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="bulk-action">Действие</Label>
            <Select
              value={action}
              onValueChange={(v) => {
                const next = v as WorkSlotsBulkAction;
                setAction(next);
                if (next !== "delete") setDeleteConfirmed(false);
                setError(null);
              }}
            >
              <SelectTrigger id="bulk-action" className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTION_LABELS) as WorkSlotsBulkAction[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ACTION_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isDelete ? (
            <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-start gap-2 text-sm text-foreground">
                <Trash2 className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <p>
                  Будут безвозвратно удалены выбранные рабочие места вместе с историей привязок. Связи
                  с клиентами сохранятся, код места у них будет сброшен.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-destructive/30 bg-background/80 p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-input accent-destructive"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                />
                <span className="text-sm leading-snug">
                  Подтверждаю удаление{" "}
                  <span className="font-semibold tabular-nums">{selectedIds.length}</span> мест
                </span>
              </label>
            </div>
          ) : null}

          {action === "is_active" ? (
            <div className="rounded-lg border bg-muted/15 p-4">
              <Label className="mb-2 block">Новый статус места</Label>
              <WorkSlotsMultiSelect
                variant="bulk"
                multiple={false}
                placeholder="Статус"
                items={[
                  { id: "active", title: "Активное" },
                  { id: "inactive", title: "Неактивное" }
                ]}
                selectedValues={[isActive ? "active" : "inactive"]}
                onChange={(next) => setIsActive((next[0] ?? "active") === "active")}
              />
            </div>
          ) : null}

          {action === "branch_code" ? (
            <div className="rounded-lg border bg-muted/15 p-4">
              <Label className="mb-2 block">Филиал (код места)</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Можно выбрать несколько филиалов — они распределятся по выбранным местам по очереди.
                Снимите все отметки, чтобы очистить филиал.
              </p>
              <WorkSlotsMultiSelect
                variant="bulk"
                placeholder="Выбрать филиал…"
                items={branchOptions.map((b) => ({ id: b, title: b }))}
                selectedValues={branchCodeList}
                onChange={setBranchCodeList}
              />
            </div>
          ) : null}

          {action === "slot_type" ? (
            <div className="rounded-lg border bg-muted/15 p-4">
              <Label className="mb-2 block">Роль места</Label>
              <WorkSlotsMultiSelect
                variant="bulk"
                multiple={false}
                placeholder="Роль"
                items={SLOT_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
                selectedValues={[slotType]}
                onChange={(next) => {
                  const v = next[0];
                  if (v) setSlotType(v as WorkSlotType);
                }}
              />
            </div>
          ) : null}

          {isTerritory ? (
            <>
              {territoryChangeCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Будет изменено полей:{" "}
                  <span className="font-medium text-foreground">{territoryChangeCount}</span>
                </p>
              ) : null}
              <WorkSlotsLocationFields
                mode="bulk"
                bulkSection="territory"
                values={location}
                onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
                territoryCascade={territoryCascade}
                warehouses={warehouses}
                cashDesks={cashDesks}
                bulkModes={locationModes}
                onBulkModesChange={(patch) =>
                  setLocationModes((prev) => ({ ...prev, ...patch }))
                }
              />
            </>
          ) : null}

          {isBindings ? (
            <>
              {bindingsChangeCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Будет изменено полей:{" "}
                  <span className="font-medium text-foreground">{bindingsChangeCount}</span>
                </p>
              ) : null}
              <WorkSlotsLocationFields
                mode="bulk"
                bulkSection="bindings"
                values={location}
                onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
                territoryCascade={territoryCascade}
                warehouses={warehouses}
                cashDesks={cashDesks}
                bulkModes={locationModes}
                onBulkModesChange={(patch) =>
                  setLocationModes((prev) => ({ ...prev, ...patch }))
                }
              />
            </>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 mt-auto shrink-0 flex-col gap-3 border-t bg-muted/25 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={cn(
              "text-xs leading-relaxed text-muted-foreground",
              isEmployeePatch ? "sm:max-w-[55%]" : "sr-only"
            )}
          >
            {isEmployeePatch
              ? "Только места с назначенным сотрудником получат новые значения"
              : " "}
          </p>
          <div className="flex w-full shrink-0 flex-row items-center justify-end gap-3 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="h-10 min-h-10 min-w-[6.5rem] flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant={isDelete ? "destructive" : "default"}
              className="h-10 min-h-10 min-w-[6.5rem] flex-1 sm:flex-none"
              disabled={saving || selectedIds.length === 0 || (isDelete && !deleteConfirmed)}
              onClick={() => void submit()}
            >
              {saving ? "Сохранение…" : isDelete ? "Удалить" : "Применить"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
