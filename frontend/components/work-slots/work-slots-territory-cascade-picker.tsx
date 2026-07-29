"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { pickCityTerritoryHint, type CityTerritoryHint } from "@/lib/city-territory-hint";
import type { RefSelectOption } from "@/lib/ref-select-options";
import {
  buildTerritoryTreeOnlyCascade,
  expandTerritoryTreeDescendants
} from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { cn } from "@/lib/utils";
import {
  WorkSlotsMultiSelect,
  refOptionsToItems
} from "./work-slots-multi-select";

export type TerritoryCascadeValues = {
  zone: string;
  region: string;
  city: string;
};

type Props = {
  values: TerritoryCascadeValues;
  onChange: (patch: Partial<TerritoryCascadeValues>) => void;
  cascade: {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
  cityTerritoryHints?: Record<string, CityTerritoryHint>;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
};

function applyTerritoryCascadeChange(
  prev: TerritoryCascadeValues,
  patch: Partial<TerritoryCascadeValues>,
  hints?: Record<string, CityTerritoryHint>
): TerritoryCascadeValues {
  let next = { ...prev, ...patch };

  if (patch.zone !== undefined && patch.zone !== prev.zone) {
    next = { ...next, region: "", city: "" };
  } else if (patch.region !== undefined && patch.region !== prev.region) {
    next = { ...next, city: "" };
  }

  if (patch.city !== undefined && patch.city.trim()) {
    const hint = pickCityTerritoryHint(hints, patch.city);
    if (hint) {
      if (hint.zone_stored) next = { ...next, zone: hint.zone_stored };
      if (hint.region_stored) next = { ...next, region: hint.region_stored };
    }
  }

  return next;
}

function labelFor(options: RefSelectOption[], value: string): string | null {
  if (!value.trim()) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}

export function WorkSlotsTerritoryCascadePicker({
  values,
  onChange,
  cascade,
  cityTerritoryHints,
  disabled,
  compact = true,
  className
}: Props) {
  const handleChange = (patch: Partial<TerritoryCascadeValues>) => {
    onChange(applyTerritoryCascadeChange(values, patch, cityTerritoryHints));
  };

  const zoneLabel = labelFor(cascade.zones, values.zone);
  const regionLabel = labelFor(cascade.regions, values.region);
  const cityLabel = labelFor(cascade.cities, values.city);
  const hasSelection = Boolean(values.zone || values.region || values.city);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-gradient-to-br from-muted/30 to-muted/10 p-3.5 sm:p-4",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-teal-600" aria-hidden />
          Территория
        </div>
        {hasSelection ? (
          <p className="text-xs text-muted-foreground">
            {[zoneLabel, regionLabel, cityLabel].filter(Boolean).join(" → ")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Зона → область → город</p>
        )}
      </div>

      <div
        className={cn(
          "grid gap-2",
          compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"
        )}
      >
        <div className="min-w-0 space-y-1">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Зона
          </span>
          <WorkSlotsMultiSelect
            variant="form"
            multiple={false}
            placeholder="Зона"
            items={refOptionsToItems(cascade.zones)}
            selectedValues={values.zone ? [values.zone] : []}
            onChange={(next) => handleChange({ zone: next[0] ?? "" })}
            disabled={disabled}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Область
          </span>
          <WorkSlotsMultiSelect
            variant="form"
            multiple={false}
            placeholder="Область"
            items={refOptionsToItems(cascade.regions)}
            selectedValues={values.region ? [values.region] : []}
            onChange={(next) => handleChange({ region: next[0] ?? "" })}
            disabled={disabled || !values.zone}
          />
        </div>
        <div className="min-w-0 space-y-1">
          <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Город
          </span>
          <WorkSlotsMultiSelect
            variant="form"
            multiple={false}
            placeholder="Город"
            items={refOptionsToItems(cascade.cities)}
            selectedValues={values.city ? [values.city] : []}
            onChange={(next) => handleChange({ city: next[0] ?? "" })}
            disabled={disabled || !values.region}
          />
        </div>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
        Зона → область → город (дерево территорий). Смена зоны сбрасывает область и город.
      </p>
    </div>
  );
}

/**
 * Guruhli qayta ishlash: faqat territory_nodes daraxti.
 * Zona → barcha oblast+gorod; oblast → barcha gorod.
 */
export function WorkSlotsTerritoryBulkPicker({
  zoneList,
  regionList,
  cityList,
  onZoneListChange,
  onRegionListChange,
  onCityListChange,
  onCascadeListsChange,
  cascade,
  territoryNodes,
  disabled
}: {
  zoneList: string[];
  regionList: string[];
  cityList: string[];
  onZoneListChange: (v: string[]) => void;
  onRegionListChange: (v: string[]) => void;
  onCityListChange: (v: string[]) => void;
  onCascadeListsChange?: (patch: {
    territoryZoneList?: string[];
    territoryOblastList?: string[];
    territoryCityList?: string[];
  }) => void;
  cascade: {
    zones: RefSelectOption[];
    regions: RefSelectOption[];
    cities: RefSelectOption[];
  };
  territoryNodes?: TerritoryNode[];
  cityTerritoryHints?: Record<string, CityTerritoryHint>;
  disabled?: boolean;
}) {
  const hasTree = (territoryNodes?.length ?? 0) > 0;

  const liveCascade = useMemo(() => {
    if (!hasTree) return cascade;
    return buildTerritoryTreeOnlyCascade(territoryNodes, {
      zones: zoneList,
      regions: regionList
    });
  }, [hasTree, territoryNodes, zoneList, regionList, cascade]);

  const handleZoneChange = (nextZones: string[]) => {
    if (!onCascadeListsChange || !hasTree) {
      onZoneListChange(nextZones);
      return;
    }
    if (nextZones.length === 0) {
      onCascadeListsChange({
        territoryZoneList: [],
        territoryOblastList: [],
        territoryCityList: []
      });
      return;
    }
    const expanded = expandTerritoryTreeDescendants(territoryNodes, nextZones, []);
    onCascadeListsChange({
      territoryZoneList: nextZones,
      territoryOblastList: expanded.regions,
      territoryCityList: expanded.cities
    });
  };

  const handleRegionChange = (nextRegions: string[]) => {
    if (!onCascadeListsChange || !hasTree) {
      onRegionListChange(nextRegions);
      return;
    }
    if (nextRegions.length === 0) {
      onCascadeListsChange({
        territoryOblastList: [],
        territoryCityList: []
      });
      return;
    }
    const expanded = expandTerritoryTreeDescendants(territoryNodes, zoneList, nextRegions);
    onCascadeListsChange({
      territoryOblastList: nextRegions,
      territoryCityList: expanded.cities
    });
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="min-w-0 space-y-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Зона
        </span>
        <WorkSlotsMultiSelect
          variant="bulk"
          placeholder="Зона (FV…)"
          items={refOptionsToItems(liveCascade.zones)}
          selectedValues={zoneList}
          onChange={handleZoneChange}
          disabled={disabled}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Область
        </span>
        <WorkSlotsMultiSelect
          variant="bulk"
          placeholder="Область"
          items={refOptionsToItems(liveCascade.regions)}
          selectedValues={regionList}
          onChange={handleRegionChange}
          disabled={disabled || (hasTree && zoneList.length === 0)}
        />
      </div>
      <div className="min-w-0 space-y-1">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-500">
          Город
        </span>
        <WorkSlotsMultiSelect
          variant="bulk"
          placeholder="Город (необязательно)"
          items={refOptionsToItems(liveCascade.cities)}
          selectedValues={cityList}
          onChange={onCityListChange}
          disabled={disabled || (hasTree && regionList.length === 0 && zoneList.length === 0)}
        />
      </div>
    </div>
  );
}
