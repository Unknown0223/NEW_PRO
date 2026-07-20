"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Hash, MapPinned, UserRound } from "lucide-react";
import {
  AgentFormField,
  AgentFormSection,
  agentModalInputClass
} from "@/components/staff/agent-workspace-template-ui";
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { WorkSlotFormDrawer } from "./work-slot-form-drawer";
import { apiFetch } from "@/lib/api-client";
import { buildZoneRegionCityCascadeOptions } from "@/lib/territory-client-filters";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { WorkSlotListItem, WorkSlotType } from "@/lib/work-slots-types";
import {
  WorkSlotsLocationFields,
  type WorkSlotsLocationValues
} from "./work-slots-location-fields";
import { SLOT_ACTIVE_STATUS_ITEMS, SLOT_TYPE_OPTIONS } from "./work-slots-utils";

type PickerOpt = { id: number; name: string };
type TradeDirectionOpt = { id: number; name: string; code: string | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: string;
  slotId: number | null;
  branchOptions: string[];
  tradeDirections: TradeDirectionOpt[];
  warehouses: PickerOpt[];
  cashDesks: PickerOpt[];
  clientRefs?: {
    zones?: string[];
    regions?: string[];
    cities?: string[];
    region_options?: { value: string; label: string }[];
    city_options?: { value: string; label: string }[];
    city_territory_hints?: Record<string, { city_label?: string | null }>;
  };
  territoryNodes: TerritoryNode[];
  onSaved: () => void;
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

export function EditSlotDialog({
  open,
  onOpenChange,
  tenant,
  slotId,
  branchOptions,
  tradeDirections,
  warehouses,
  cashDesks,
  clientRefs,
  territoryNodes,
  onSaved
}: Props) {
  const [original, setOriginal] = useState<WorkSlotListItem | null>(null);
  const [slotCode, setSlotCode] = useState("");
  const [label, setLabel] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [slotType, setSlotType] = useState<WorkSlotType>("agent");
  const [isActive, setIsActive] = useState(true);
  const [location, setLocation] = useState<WorkSlotsLocationValues>(emptyLocation);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveTerritoryDisplay = useMemo(
    () =>
      createTerritoryLabelResolver({
        zones: clientRefs?.zones,
        region_options: clientRefs?.region_options,
        city_options: clientRefs?.city_options,
        city_territory_hints: clientRefs?.city_territory_hints,
        territory_nodes: territoryNodes
      }),
    [clientRefs, territoryNodes]
  );

  const territoryCascade = useMemo(() => {
    const mapOpts = (opts: RefSelectOption[]): RefSelectOption[] =>
      opts.map((o) => ({
        value: o.value,
        label: resolveTerritoryDisplay(o.value)
      }));

    const raw = buildZoneRegionCityCascadeOptions(clientRefs, undefined, territoryNodes, {
      zone: location.territoryZone,
      region: location.territoryOblast,
      city: location.territoryCity
    });
    return {
      zones: mapOpts(raw.zones),
      regions: mapOpts(raw.regions),
      cities: mapOpts(raw.cities)
    };
  }, [clientRefs, territoryNodes, location, resolveTerritoryDisplay]);

  useEffect(() => {
    if (!open || !slotId || !tenant) return;
    setLoading(true);
    setError(null);
    void apiFetch<{ data: WorkSlotListItem }>(`/api/${tenant}/work-slots/${slotId}`)
      .then((res) => {
        const d = res.data;
        setOriginal(d);
        setSlotCode(d.slot_code ?? "");
        setLabel(d.label ?? "");
        setBranchCode(d.branch_code ?? "");
        setDirectionId(d.direction_id != null ? String(d.direction_id) : "");
        setSlotType(d.slot_type as WorkSlotType);
        setIsActive(d.is_active);
        setLocation({
          territoryZone: d.active_territory_zone ?? "",
          territoryOblast: d.active_territory_oblast ?? "",
          territoryCity: d.active_territory_city ?? "",
          territoryZoneList: [],
          territoryOblastList: [],
          territoryCityList: [],
          warehouseId: d.active_warehouse_id,
          returnWarehouseId: d.return_warehouse_id ?? null,
          cashDeskId: d.active_cash_desk_id
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [open, slotId, tenant]);

  const submit = async () => {
    if (!slotId || !original) return;
    const code = slotCode.trim().toUpperCase();
    if (!code) {
      setError("Smart-код обязателен");
      return;
    }
    if (!/^[A-Z0-9-]{1,32}$/.test(code)) {
      setError("Код: буквы, цифры или дефис (1–32)");
      return;
    }

    const changes: Record<string, unknown> = {};
    const l = label.trim() || null;
    const b = branchCode.trim() || null;
    if (code !== (original.slot_code ?? "").trim().toUpperCase()) changes.slot_code = code;
    if (l !== (original.label ?? null)) changes.label = l;
    if (b !== (original.branch_code ?? null)) changes.branch_code = b;
    const dirParsed = directionId.trim() ? Number.parseInt(directionId.trim(), 10) : null;
    if (dirParsed !== (original.direction_id ?? null)) changes.direction_id = dirParsed;
    if (slotType !== original.slot_type) changes.slot_type = slotType;
    if (isActive !== original.is_active) changes.is_active = isActive;

    const origLoc: WorkSlotsLocationValues = {
      territoryZone: original.active_territory_zone ?? "",
      territoryOblast: original.active_territory_oblast ?? "",
      territoryCity: original.active_territory_city ?? "",
      territoryZoneList: [],
      territoryOblastList: [],
      territoryCityList: [],
      warehouseId: original.active_warehouse_id,
      returnWarehouseId: original.return_warehouse_id ?? null,
      cashDeskId: original.active_cash_desk_id
    };

    if (location.territoryZone !== origLoc.territoryZone) {
      changes.territory_zone = location.territoryZone.trim() || null;
    }
    if (location.territoryOblast !== origLoc.territoryOblast) {
      changes.territory_oblast = location.territoryOblast.trim() || null;
    }
    if (location.territoryCity !== origLoc.territoryCity) {
      changes.territory_city = location.territoryCity.trim() || null;
    }
    if (location.warehouseId !== origLoc.warehouseId) {
      changes.warehouse_id = location.warehouseId;
    }
    if (location.returnWarehouseId !== origLoc.returnWarehouseId) {
      changes.return_warehouse_id = location.returnWarehouseId;
    }
    if (location.cashDeskId !== origLoc.cashDeskId) {
      changes.cash_desk_id = location.cashDeskId;
    }

    const hasUserAttrs =
      changes.territory_zone !== undefined ||
      changes.territory_oblast !== undefined ||
      changes.territory_city !== undefined ||
      changes.warehouse_id !== undefined ||
      changes.return_warehouse_id !== undefined ||
      changes.cash_desk_id !== undefined;

    if (hasUserAttrs && !original.active_user_id) {
      setError("Нет сотрудника на месте — сначала назначьте сотрудника");
      return;
    }

    if (Object.keys(changes).length === 0) {
      setError("Нет изменений");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/${tenant}/work-slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes)
      });
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkSlotFormDrawer
      open={open}
      title="Редактирование рабочего места"
      subtitle={
        original ? (
          <>
            Smart-код: <span className="font-mono font-medium text-slate-700">{original.slot_code}</span>
            {original.active_user_name ? (
              <>
                {" "}
                · сотрудник: <span className="font-medium text-slate-700">{original.active_user_name}</span>
              </>
            ) : (
              " · место свободно"
            )}
          </>
        ) : (
          "Загрузка данных места…"
        )
      }
      onClose={() => onOpenChange(false)}
      onSubmit={() => void submit()}
      submitDisabled={loading || !original}
      submitBusy={saving}
      submitError={error}
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <div className="space-y-5">
          <AgentFormSection title="Основное" icon={<Hash className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AgentFormField label="Smart-код">
                <div className="relative">
                  <input
                    id="edit-slot-code"
                    value={slotCode}
                    onChange={(e) => setSlotCode(e.target.value.toUpperCase())}
                    maxLength={32}
                    readOnly={false}
                    className={`${agentModalInputClass} pr-14 font-mono`}
                    autoComplete="off"
                    placeholder="A-SERGEli-001"
                    aria-describedby="edit-slot-code-hint"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {slotCode.length}/32
                  </span>
                </div>
                <p id="edit-slot-code-hint" className="mt-1 text-xs text-muted-foreground">
                  Уникальный код места — можно изменить вручную
                </p>
              </AgentFormField>
              <AgentFormField label="Название">
                <input
                  id="edit-slot-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className={agentModalInputClass}
                  placeholder="Север — розница"
                />
              </AgentFormField>
              <AgentFormField label="Роль">
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={false}
                  placeholder="Роль"
                  items={SLOT_TYPE_OPTIONS.map((o) => ({ id: o.value, title: o.label }))}
                  selectedValues={[slotType]}
                  onChange={(next) => {
                    const v = next[0];
                    if (v) setSlotType(v as WorkSlotType);
                  }}
                />
              </AgentFormField>
              <AgentFormField label="Статус места">
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={false}
                  placeholder="Статус"
                  items={SLOT_ACTIVE_STATUS_ITEMS}
                  selectedValues={[isActive ? "true" : "false"]}
                  onChange={(next) => setIsActive((next[0] ?? "true") === "true")}
                />
              </AgentFormField>
            </div>
          </AgentFormSection>

          <AgentFormSection title="Филиал и направление" icon={<Building2 className="h-4 w-4" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AgentFormField label="Филиал">
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={false}
                  placeholder="Филиал"
                  items={[
                    { id: "__none__", title: "—" },
                    ...branchOptions.map((b) => ({ id: b, title: b }))
                  ]}
                  selectedValues={branchCode ? [branchCode] : []}
                  onChange={(next) => {
                    const v = next[0] ?? "";
                    setBranchCode(v === "__none__" ? "" : v);
                  }}
                />
              </AgentFormField>
              <AgentFormField label="Направление торговли">
                <WorkSlotsMultiSelect
                  variant="form"
                  multiple={false}
                  placeholder="Направление"
                  items={[
                    { id: "__none__", title: "—" },
                    ...tradeDirections.map((t) => ({
                      id: String(t.id),
                      title: t.code ? `${t.name} (${t.code})` : t.name
                    }))
                  ]}
                  selectedValues={directionId ? [directionId] : []}
                  onChange={(next) => {
                    const v = next[0] ?? "";
                    setDirectionId(v === "__none__" ? "" : v);
                  }}
                />
              </AgentFormField>
            </div>
          </AgentFormSection>

          <AgentFormSection title="Сотрудник на месте" icon={<UserRound className="h-4 w-4" />}>
            {!original?.active_user_id ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                На месте нет сотрудника. Территория и привязки (склад, касса) станут доступны после
                назначения.
              </p>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">
                Территория и привязки сохраняются в профиле сотрудника на этом месте.
              </p>
            )}
            <WorkSlotsLocationFields
              mode="edit"
              values={location}
              onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
              territoryCascade={territoryCascade}
              cityTerritoryHints={clientRefs?.city_territory_hints as Record<string, import("@/lib/city-territory-hint").CityTerritoryHint> | undefined}
              warehouses={warehouses}
              cashDesks={cashDesks}
              disabled={!original?.active_user_id}
            />
          </AgentFormSection>

          <AgentFormSection title="Подсказка" icon={<MapPinned className="h-4 w-4" />}>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Конфигурация (цены, лимиты, entitlements) настраивается на странице места в разделе{" "}
              <span className="font-medium text-foreground">Конфигурация</span>.
            </p>
          </AgentFormSection>
        </div>
      )}
    </WorkSlotFormDrawer>
  );
}
