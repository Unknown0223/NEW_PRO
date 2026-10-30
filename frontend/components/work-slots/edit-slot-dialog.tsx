"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Hash, UserRound } from "lucide-react";
import {
  AgentFormField,
  AgentFormSection,
  agentModalInputClass
} from "@/components/staff/agent-workspace-template-ui";
import { WorkSlotsMultiSelect } from "./work-slots-multi-select";
import { WorkSlotFormDrawer } from "./work-slot-form-drawer";
import { apiFetch } from "@/lib/api-client";
import { buildZoneRegionCityCascadeOptions, normalizeWorkSlotTerritoryLists } from "@/lib/territory-client-filters";
import { createTerritoryLabelResolver } from "@/lib/territory-filter-labels";
import type { RefSelectOption } from "@/lib/ref-select-options";
import type { TerritoryNode } from "@/lib/territory-tree";
import type { WorkSlotListItem, WorkSlotType } from "@/lib/work-slots-types";
import { slotCodeMatchesType, slotCodeTypeMismatchMessage } from "@/lib/work-slots-types";
import {
  WorkSlotsLocationFields,
  emptyLocationValues,
  type WorkSlotsLocationValues
} from "./work-slots-location-fields";
import { SLOT_ACTIVE_STATUS_ITEMS, SLOT_TYPE_OPTIONS, parseUserTerritoryParts } from "./work-slots-utils";
import {
  slotLocationBindingFields,
  slotSupportsDirection,
  slotSupportsTerritory
} from "./work-slots-bulk-actions";

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

const emptyLocation = (): WorkSlotsLocationValues => emptyLocationValues();

function locationFromSlot(
  d: WorkSlotListItem,
  territoryNodes?: TerritoryNode[]
): WorkSlotsLocationValues {
  const warehouseIds =
    d.active_warehouse_ids?.length
      ? d.active_warehouse_ids
      : d.active_warehouse_id != null
        ? [d.active_warehouse_id]
        : [];
  const cashDeskIds =
    d.active_cash_desk_ids?.length
      ? d.active_cash_desk_ids
      : d.active_cash_desk_id != null
        ? [d.active_cash_desk_id]
        : [];
  const territories = d.active_territories?.length
    ? d.active_territories
    : d.active_user_territory
      ? [d.active_user_territory]
      : [];
  const zoneList: string[] = [];
  const oblastList: string[] = [];
  const cityList: string[] = [];
  for (const t of territories) {
    const p = parseUserTerritoryParts(t);
    if (p.zone && !zoneList.includes(p.zone)) zoneList.push(p.zone);
    if (p.oblast && !oblastList.includes(p.oblast)) oblastList.push(p.oblast);
    if (p.city && !cityList.includes(p.city)) cityList.push(p.city);
  }
  // Singular API maydonlari ham qo‘shiladi (ro‘yxat bo‘sh bo‘lsa)
  if (d.active_territory_zone?.trim() && !zoneList.includes(d.active_territory_zone.trim())) {
    zoneList.push(d.active_territory_zone.trim());
  }
  if (d.active_territory_oblast?.trim() && !oblastList.includes(d.active_territory_oblast.trim())) {
    oblastList.push(d.active_territory_oblast.trim());
  }
  if (d.active_territory_city?.trim() && !cityList.includes(d.active_territory_city.trim())) {
    cityList.push(d.active_territory_city.trim());
  }

  const normalized = normalizeWorkSlotTerritoryLists(
    { zones: zoneList, regions: oblastList, cities: cityList },
    territoryNodes
  );

  return {
    territoryZone: normalized.zones[0] ?? "",
    territoryOblast: normalized.regions[0] ?? "",
    territoryCity: normalized.cities[0] ?? "",
    territoryZoneList: normalized.zones,
    territoryOblastList: normalized.regions,
    territoryCityList: normalized.cities,
    warehouseId: warehouseIds[0] ?? null,
    warehouseIds,
    returnWarehouseId: d.return_warehouse_id ?? null,
    cashDeskId: cashDeskIds[0] ?? null,
    cashDeskIds
  };
}

function branchesFromSlot(d: WorkSlotListItem): string[] {
  const codes = (d.branch_codes ?? []).map((c) => c.trim()).filter(Boolean);
  if (codes.length) return codes;
  return d.branch_code?.trim() ? [d.branch_code.trim()] : [];
}

function sameStringList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

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
  const [branchCodeList, setBranchCodeList] = useState<string[]>([]);
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
        setBranchCodeList(branchesFromSlot(d));
        setDirectionId(d.direction_id != null ? String(d.direction_id) : "");
        setSlotType(d.slot_type as WorkSlotType);
        setIsActive(d.is_active);
        setLocation(locationFromSlot(d, territoryNodes));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [open, slotId, tenant, territoryNodes]);

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
    if (!slotCodeMatchesType(code, slotType)) {
      setError(slotCodeTypeMismatchMessage(code, slotType));
      return;
    }

    const changes: Record<string, unknown> = {};
    const l = label.trim() || null;
    // slot_code PATCH backendda qo‘llab-quvvatlanmaydi — faqat type bilan mosligi tekshiriladi
    if (l !== (original.label ?? null)) changes.label = l;
    const origBranches = branchesFromSlot(original);
    if (!sameStringList(branchCodeList, origBranches)) {
      changes.branch_codes = branchCodeList;
      changes.branch_code = branchCodeList[0] ?? null;
    }
    const dirParsed = directionId.trim() ? Number.parseInt(directionId.trim(), 10) : null;
    if (dirParsed !== (original.direction_id ?? null)) changes.direction_id = dirParsed;
    if (slotType !== original.slot_type) changes.slot_type = slotType;
    if (isActive !== original.is_active) changes.is_active = isActive;

    const origLoc = locationFromSlot(original, territoryNodes);

    const sameIds = (a: number[], b: number[]) =>
      a.length === b.length && a.every((id, i) => id === b[i]);

    const hasTerritoryLists =
      location.territoryZoneList.length > 0 ||
      location.territoryOblastList.length > 0 ||
      location.territoryCityList.length > 0;
    const origHasTerritoryLists =
      origLoc.territoryZoneList.length > 0 ||
      origLoc.territoryOblastList.length > 0 ||
      origLoc.territoryCityList.length > 0;

    if (
      hasTerritoryLists ||
      origHasTerritoryLists ||
      location.territoryZone !== origLoc.territoryZone ||
      location.territoryOblast !== origLoc.territoryOblast ||
      location.territoryCity !== origLoc.territoryCity
    ) {
      if (
        location.territoryZoneList.length > 1 ||
        location.territoryOblastList.length > 1 ||
        location.territoryCityList.length > 1 ||
        (hasTerritoryLists &&
          (location.territoryZoneList.length !== origLoc.territoryZoneList.length ||
            location.territoryOblastList.length !== origLoc.territoryOblastList.length ||
            location.territoryCityList.length !== origLoc.territoryCityList.length ||
            location.territoryZoneList.some((z, i) => z !== origLoc.territoryZoneList[i]) ||
            location.territoryOblastList.some((z, i) => z !== origLoc.territoryOblastList[i]) ||
            location.territoryCityList.some((z, i) => z !== origLoc.territoryCityList[i])))
      ) {
        if (location.territoryZoneList.length) changes.territory_zones = location.territoryZoneList;
        if (location.territoryOblastList.length) changes.territory_oblasts = location.territoryOblastList;
        if (location.territoryCityList.length) changes.territory_cities = location.territoryCityList;
        if (
          !location.territoryZoneList.length &&
          !location.territoryOblastList.length &&
          !location.territoryCityList.length
        ) {
          changes.territories = [];
        }
      } else {
        if (location.territoryZone !== origLoc.territoryZone) {
          changes.territory_zone = location.territoryZone.trim() || null;
        }
        if (location.territoryOblast !== origLoc.territoryOblast) {
          changes.territory_oblast = location.territoryOblast.trim() || null;
        }
        if (location.territoryCity !== origLoc.territoryCity) {
          changes.territory_city = location.territoryCity.trim() || null;
        }
      }
    }

    if (!sameIds(location.warehouseIds, origLoc.warehouseIds)) {
      changes.warehouse_ids = location.warehouseIds;
      changes.warehouse_id = location.warehouseIds[0] ?? null;
    }
    if (location.returnWarehouseId !== origLoc.returnWarehouseId) {
      changes.return_warehouse_id = location.returnWarehouseId;
    }
    if (!sameIds(location.cashDeskIds, origLoc.cashDeskIds)) {
      changes.cash_desk_ids = location.cashDeskIds;
      changes.cash_desk_id = location.cashDeskIds[0] ?? null;
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
      if (e instanceof Error && "apiBody" in e) {
        const apiErr = e as Error & { apiBody?: { error?: string; message?: string } };
        const code = apiErr.apiBody?.error?.trim();
        if (code === "CodeTaken") {
          setError("Этот Smart-код уже занят — укажите другой код");
          return;
        }
        if (apiErr.apiBody?.message?.trim()) {
          setError(apiErr.apiBody.message.trim());
          return;
        }
        if (code) {
          setError(code);
          return;
        }
      }
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
                  placeholder="Филиалы"
                  items={branchOptions.map((b) => ({ id: b, title: b }))}
                  selectedValues={branchCodeList}
                  onChange={setBranchCodeList}
                />
                <p className="mt-1 text-xs text-muted-foreground">Можно выбрать несколько филиалов</p>
              </AgentFormField>
              {slotSupportsDirection(slotType) ? (
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
              ) : null}
            </div>
          </AgentFormSection>

          <AgentFormSection title="Сотрудник на месте" icon={<UserRound className="h-4 w-4" />}>
            {!original?.active_user_id ? (
              <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                На месте нет сотрудника — территория и привязки всё равно сохранятся на уровне места.
              </p>
            ) : (
              <p className="mb-3 text-xs text-muted-foreground">
                Территория и привязки сохраняются на месте и зеркалятся сотруднику.
              </p>
            )}
            <WorkSlotsLocationFields
              mode="edit"
              values={location}
              onChange={(patch) => setLocation((prev) => ({ ...prev, ...patch }))}
              territoryCascade={territoryCascade}
              territoryNodes={territoryNodes}
              cityTerritoryHints={clientRefs?.city_territory_hints as Record<string, import("@/lib/city-territory-hint").CityTerritoryHint> | undefined}
              warehouses={warehouses}
              cashDesks={cashDesks}
              showTerritory={slotSupportsTerritory(slotType)}
              bulkBindingFields={slotLocationBindingFields(slotType)}
            />
          </AgentFormSection>
        </div>
      )}
    </WorkSlotFormDrawer>
  );
}
