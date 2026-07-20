"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3, Trash2, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AgentFormField,
  AgentFormSection,
  agentModalInputClass
} from "@/components/staff/agent-workspace-template-ui";
import { apiFetch } from "@/lib/api-client";
import { messageFromWorkSlotsBulkError } from "@/lib/work-slots-bulk-errors";
import type { WorkSlotType } from "@/lib/work-slots-types";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { WorkSlotFormDrawer } from "./work-slot-form-drawer";
import { WorkSlotsBulkField } from "./work-slots-bulk-field";
import { SLOT_TYPE_OPTIONS } from "./work-slots-utils";
import {
  EMPTY_BULK_FORM_MODES,
  bulkDestructiveActionsForSlotType,
  bulkFieldsForSlotType,
  buildBulkRequestBody,
  countBulkFormChanges,
  validateBulkForm,
  type WorkSlotsBulkDestructiveAction,
  type WorkSlotsBulkFormModes,
  type WorkSlotsBulkFormValues
} from "./work-slots-bulk-actions";
import {
  EMPTY_LOCATION_BULK_MODES,
  WorkSlotsLocationFields,
  type WorkSlotsLocationBulkModes,
  type WorkSlotsLocationValues
} from "./work-slots-location-fields";

export type WorkSlotsBulkResult = {
  updated?: number;
  deleted?: number;
  unassigned?: number;
  users_updated?: number;
  skipped_no_user?: number;
};

type PickerOpt = { id: number; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  selectedIds: number[];
  slotType: WorkSlotType;
  branchOptions: string[];
  tradeDirections: PickerOpt[];
  territoryCascade: {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  onDone: (result: WorkSlotsBulkResult) => void;
};

const emptyLocation = (): WorkSlotsLocationValues => ({
  territoryZone: "",
  territoryOblast: "",
  territoryCity: "",
  territoryZoneList: [],
  territoryOblastList: [],
  territoryCityList: [],
  warehouseId: null,
  returnWarehouseId: null,
  cashDeskId: null
});

function bindingFieldsForRole(fields: ReturnType<typeof bulkFieldsForSlotType>) {
  const out: Array<"warehouse" | "return_warehouse" | "cash_desk"> = [];
  if (fields.includes("warehouse_id")) out.push("warehouse");
  if (fields.includes("return_warehouse_id")) out.push("return_warehouse");
  if (fields.includes("cash_desk_id")) out.push("cash_desk");
  return out;
}

export function WorkSlotsBulkDialog({
  open,
  onOpenChange,
  tenant,
  selectedIds,
  slotType,
  branchOptions,
  tradeDirections,
  territoryCascade,
  warehouses,
  cashDesks,
  onDone
}: Props) {
  const fields = useMemo(() => bulkFieldsForSlotType(slotType), [slotType]);
  const destructiveActions = useMemo(() => bulkDestructiveActionsForSlotType(slotType), [slotType]);
  const bindingFields = useMemo(() => bindingFieldsForRole(fields), [fields]);

  const [formModes, setFormModes] = useState<WorkSlotsBulkFormModes>(EMPTY_BULK_FORM_MODES());
  const [formValues, setFormValues] = useState<WorkSlotsBulkFormValues>({
    isActive: true,
    branchCodeList: [],
    directionId: "",
    label: "",
    slotType: "agent"
  });
  const [location, setLocation] = useState<WorkSlotsLocationValues>(emptyLocation());
  const [locationModes, setLocationModes] = useState<WorkSlotsLocationBulkModes>(EMPTY_LOCATION_BULK_MODES());
  const [destructive, setDestructive] = useState<WorkSlotsBulkDestructiveAction | null>(null);
  const [unassignConfirmed, setUnassignConfirmed] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeCount = useMemo(
    () => countBulkFormChanges(fields, formModes, locationModes),
    [fields, formModes, locationModes]
  );

  const showLocationSection =
    fields.includes("territory") ||
    fields.includes("warehouse_id") ||
    fields.includes("return_warehouse_id") ||
    fields.includes("cash_desk_id");

  useEffect(() => {
    if (!open) return;
    setFormModes(EMPTY_BULK_FORM_MODES());
    setFormValues({
      isActive: true,
      branchCodeList: [],
      directionId: "",
      label: "",
      slotType
    });
    setLocation(emptyLocation());
    setLocationModes(EMPTY_LOCATION_BULK_MODES());
    setDestructive(null);
    setUnassignConfirmed(false);
    setDeleteConfirmed(false);
    setError(null);
  }, [open, slotType]);

  const submit = async () => {
    if (!selectedIds.length) return;

    if (destructive === "delete" && !deleteConfirmed) {
      setError("Подтвердите удаление");
      return;
    }
    if (destructive === "unassign" && !unassignConfirmed) {
      setError("Подтвердите снятие сотрудника");
      return;
    }

    if (!destructive) {
      const validationError = validateBulkForm(fields, formModes, formValues, location, locationModes);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (changeCount === 0) {
        setError("Выберите хотя бы одно поле для изменения (не «Не менять»)");
        return;
      }
    }

    const body = buildBulkRequestBody(
      selectedIds,
      fields,
      formModes,
      formValues,
      location,
      locationModes,
      destructive
    );

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
      setError(messageFromWorkSlotsBulkError(e));
    } finally {
      setSaving(false);
    }
  };

  const isDelete = destructive === "delete";
  const isUnassign = destructive === "unassign";
  const submitDisabled =
    selectedIds.length === 0 ||
    (isDelete && !deleteConfirmed) ||
    (isUnassign && !unassignConfirmed);

  const submitLabel = saving
    ? "Сохранение…"
    : isDelete
      ? "Удалить"
      : isUnassign
        ? "Снять"
        : "Применить";

  return (
    <WorkSlotFormDrawer
      open={open}
      title="Групповая обработка"
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span>Общие поля для всех выбранных мест</span>
          <Badge variant="secondary" className="text-xs font-normal tabular-nums">
            {selectedIds.length} мест
          </Badge>
        </span>
      }
      onClose={() => onOpenChange(false)}
      widthClass="sm:max-w-2xl lg:max-w-3xl"
      footer={
        <div className="shrink-0 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
          {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
          {!destructive && changeCount > 0 ? (
            <p className="mb-3 text-xs text-muted-foreground">
              Будет изменено полей:{" "}
              <span className="font-medium text-foreground">{changeCount}</span>
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={submitDisabled || saving}
              onClick={() => void submit()}
              className={
                isDelete
                  ? "rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  : "rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/25 transition hover:from-teal-700 hover:to-teal-600 disabled:opacity-50"
              }
            >
              {submitLabel}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Для каждого поля выберите «Не менять», «Очистить» или «Задать». Можно изменить несколько
          полей за один раз. Типы цен и консигнация — только в карточке места (групповая обработка
          пока не поддерживается).
        </p>

        <AgentFormSection title="Поля места" icon={<Layers3 className="h-4 w-4" />}>
          <div className="space-y-4">
            {fields.includes("is_active") ? (
              <WorkSlotsBulkField
                label="Статус (активное / неактивное)"
                mode={formModes.isActive}
                onModeChange={(m) => setFormModes((prev) => ({ ...prev, isActive: m }))}
                disabled={Boolean(destructive) || saving}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  multiple={false}
                  placeholder="Статус"
                  items={[
                    { id: "active", title: "Активное" },
                    { id: "inactive", title: "Неактивное" }
                  ]}
                  selectedValues={[formValues.isActive ? "active" : "inactive"]}
                  onChange={(next) =>
                    setFormValues((prev) => ({
                      ...prev,
                      isActive: (next[0] ?? "active") === "active"
                    }))
                  }
                  disabled={Boolean(destructive) || saving}
                />
              </WorkSlotsBulkField>
            ) : null}

            {fields.includes("branch_code") ? (
              <WorkSlotsBulkField
                label="Филиал"
                mode={formModes.branchCode}
                onModeChange={(m) => setFormModes((prev) => ({ ...prev, branchCode: m }))}
                disabled={Boolean(destructive) || saving}
              >
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Несколько филиалов распределяются по местам по очереди.
                </p>
                <WorkSlotsMultiSelect
                  variant="bulk"
                  placeholder="Выбрать филиал…"
                  items={branchOptions.map((b) => ({ id: b, title: b }))}
                  selectedValues={formValues.branchCodeList}
                  onChange={(branchCodeList) =>
                    setFormValues((prev) => ({ ...prev, branchCodeList }))
                  }
                  disabled={Boolean(destructive) || saving}
                />
              </WorkSlotsBulkField>
            ) : null}

            {fields.includes("direction_id") ? (
              <WorkSlotsBulkField
                label="Направление торговли"
                mode={formModes.directionId}
                onModeChange={(m) => setFormModes((prev) => ({ ...prev, directionId: m }))}
                disabled={Boolean(destructive) || saving}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  multiple={false}
                  placeholder="Направление"
                  items={tradeDirections.map((d) => ({ id: String(d.id), title: d.name }))}
                  selectedValues={formValues.directionId ? [formValues.directionId] : []}
                  onChange={(next) =>
                    setFormValues((prev) => ({ ...prev, directionId: next[0] ?? "" }))
                  }
                  disabled={Boolean(destructive) || saving}
                />
              </WorkSlotsBulkField>
            ) : null}

            {fields.includes("label") ? (
              <WorkSlotsBulkField
                label="Название / метка места"
                mode={formModes.label}
                onModeChange={(m) => setFormModes((prev) => ({ ...prev, label: m }))}
                disabled={Boolean(destructive) || saving}
              >
                <AgentFormField label="">
                  <input
                    className={agentModalInputClass}
                    value={formValues.label}
                    onChange={(e) => setFormValues((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="Например: Центральный агент"
                    disabled={Boolean(destructive) || saving}
                  />
                </AgentFormField>
              </WorkSlotsBulkField>
            ) : null}

            {fields.includes("slot_type") ? (
              <WorkSlotsBulkField
                label="Роль места"
                mode={formModes.slotType}
                onModeChange={(m) => setFormModes((prev) => ({ ...prev, slotType: m }))}
                disabled={Boolean(destructive) || saving}
              >
                <WorkSlotsMultiSelect
                  variant="bulk"
                  multiple={false}
                  placeholder="Роль"
                  items={SLOT_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={[formValues.slotType]}
                  onChange={(next) => {
                    const v = next[0];
                    if (v) setFormValues((prev) => ({ ...prev, slotType: v as WorkSlotType }));
                  }}
                  disabled={Boolean(destructive) || saving}
                />
              </WorkSlotsBulkField>
            ) : null}
          </div>
        </AgentFormSection>

        {showLocationSection && !destructive ? (
          <AgentFormSection title="Территория и привязки" icon={<Layers3 className="h-4 w-4" />}>
            <WorkSlotsLocationFields
              mode="bulk"
              bulkSection="all"
              bulkBindingFields={bindingFields}
              values={location}
              onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
              territoryCascade={territoryCascade}
              warehouses={warehouses}
              cashDesks={cashDesks}
              bulkModes={locationModes}
              onBulkModesChange={(patch) => setLocationModes((prev) => ({ ...prev, ...patch }))}
              disabled={saving}
            />
          </AgentFormSection>
        ) : null}

        {destructiveActions.length > 0 ? (
          <AgentFormSection title="Опасные действия" icon={<Trash2 className="h-4 w-4" />}>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Выберите одно действие вместо изменения полей выше. Остальные настройки места при
                снятии сотрудника сохраняются.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={
                    destructive === null
                      ? "rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                      : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  }
                  onClick={() => {
                    setDestructive(null);
                    setUnassignConfirmed(false);
                    setDeleteConfirmed(false);
                    setError(null);
                  }}
                >
                  Изменить поля
                </button>
                {destructiveActions.includes("unassign") ? (
                  <button
                    type="button"
                    className={
                      destructive === "unassign"
                        ? "rounded-lg border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
                        : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    }
                    onClick={() => {
                      setDestructive("unassign");
                      setDeleteConfirmed(false);
                      setError(null);
                    }}
                  >
                    Снять сотрудника
                  </button>
                ) : null}
                {destructiveActions.includes("delete") ? (
                  <button
                    type="button"
                    className={
                      destructive === "delete"
                        ? "rounded-lg border border-destructive bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
                        : "rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    }
                    onClick={() => {
                      setDestructive("delete");
                      setUnassignConfirmed(false);
                      setError(null);
                    }}
                  >
                    Удалить места
                  </button>
                ) : null}
              </div>

              {isUnassign ? (
                <div className="space-y-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4">
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <UserMinus className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
                    <p>
                      С выбранных мест будут сняты назначенные сотрудники. Настройки места
                      сохранятся.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-200/60 bg-background/80 p-3">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-input accent-amber-600"
                      checked={unassignConfirmed}
                      onChange={(e) => setUnassignConfirmed(e.target.checked)}
                    />
                    <span className="text-sm leading-snug">
                      Подтверждаю снятие с{" "}
                      <span className="font-semibold tabular-nums">{selectedIds.length}</span> мест
                    </span>
                  </label>
                </div>
              ) : null}

              {isDelete ? (
                <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
                  <div className="flex items-start gap-2 text-sm text-foreground">
                    <Trash2 className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <p>
                      Будут удалены выбранные места вместе с историей привязок. Связи с клиентами
                      сохранятся.
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
            </div>
          </AgentFormSection>
        ) : null}
      </div>
    </WorkSlotFormDrawer>
  );
}
