"use client";

import { FilterMultiSelect } from "@/components/clients/visit-planner/visit-planner-pickers";
import type { GeoBoundary } from "@/lib/geo-boundaries-types";
import { GEO_BOUNDARY_KIND_LABELS } from "@/lib/geo-boundaries-types";
import type { GeoCatalogItem } from "@/hooks/use-visit-planner-catalog";
import type { RefSelectOption } from "@/lib/ref-select-options";
import { ChevronDown, MapPinned } from "lucide-react";
import Link from "next/link";

type Props = {
  expanded: boolean;
  onToggleExpanded: () => void;
  region: string;
  onRegionChange: (v: string) => void;
  regionOptions: RefSelectOption[];
  cities: string[];
  onCitiesChange: (v: string[]) => void;
  cityOptions: RefSelectOption[];
  branchRefId: string;
  onBranchRefIdChange: (v: string) => void;
  branchItems: GeoCatalogItem[];
  activeBoundaryId: string;
  onActiveBoundaryIdChange: (v: string) => void;
  boundaries: GeoBoundary[];
  clientCount: number;
  filterReady: boolean;
};

export function VisitPlannerTerritoryFilterBar({
  expanded,
  onToggleExpanded,
  region,
  onRegionChange,
  regionOptions,
  cities,
  onCitiesChange,
  cityOptions,
  branchRefId,
  onBranchRefIdChange,
  branchItems,
  activeBoundaryId,
  onActiveBoundaryIdChange,
  boundaries,
  clientCount,
  filterReady
}: Props) {
  const regionLabel = regionOptions.find((o) => o.value === region)?.label ?? (region || "Viloyat tanlang");
  const cityMultiOptions = cityOptions
    .filter((o) => o.value)
    .map((o) => ({ value: o.value, label: o.label, searchText: o.label }));

  return (
    <div className={`vp-geo-bar${expanded ? " vp-geo-bar-open" : ""}`}>
      <button type="button" className="vp-geo-toggle" onClick={onToggleExpanded} aria-expanded={expanded}>
        <MapPinned className="size-4 shrink-0 text-violet-600" aria-hidden />
        <span className="vp-geo-toggle-label">Hudud</span>
        <span className="vp-geo-toggle-value">{filterReady ? regionLabel : "Viloyat majburiy"}</span>
        {filterReady ? <span className="vp-geo-badge">{clientCount} klient</span> : null}
        <ChevronDown className={`vp-geo-chevron size-4 shrink-0${expanded ? " vp-open" : ""}`} aria-hidden />
      </button>

      {expanded ? (
        <div className="vp-geo-panel">
          <p className="vp-geo-hint">
            Avval viloyatni tanlang, keyin shahar(lar) va filial. Chegara bo‘yicha filtrlash ixtiyoriy. Chegara chizish —{" "}
            <Link href="/settings/geo-boundaries" className="text-primary underline">
              Sozlamalar → Xarita chegaralari
            </Link>
            .
          </p>

          <div className="vp-geo-row">
            <label className="vp-geo-label vp-geo-label-inline">
              <span>Viloyat *</span>
              <select
                className="vp-native"
                value={region}
                onChange={(e) => onRegionChange(e.target.value)}
              >
                <option value="">— Viloyat tanlang —</option>
                {regionOptions
                  .filter((o) => o.value)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>

            <div className="vp-geo-label vp-geo-label-inline vp-fb-field">
              <span>Shaharlar</span>
              <FilterMultiSelect
                options={region ? cityMultiOptions : []}
                selected={cities}
                onChange={onCitiesChange}
                placeholder={region ? "Barcha shaharlar" : "Avval viloyat"}
                searchPlaceholder="Shahar qidirish…"
              />
            </div>

            <label className="vp-geo-label vp-geo-label-inline">
              <span>Filial</span>
              <select
                className="vp-native"
                value={branchRefId}
                onChange={(e) => onBranchRefIdChange(e.target.value)}
                disabled={!region}
              >
                <option value="">— Barcha filiallar —</option>
                {branchItems.map((b) => (
                  <option key={b.ref_id} value={b.ref_id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="vp-geo-label vp-geo-label-inline">
              <span>Chegara</span>
              <select
                className="vp-native"
                value={activeBoundaryId}
                onChange={(e) => onActiveBoundaryIdChange(e.target.value)}
                disabled={!region}
              >
                <option value="">— Chegarasiz —</option>
                {boundaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({GEO_BOUNDARY_KIND_LABELS[b.kind]})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!region ? (
            <p className="vp-geo-warn">Viloyat tanlanmaguncha klientlar ko‘rinmaydi.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
