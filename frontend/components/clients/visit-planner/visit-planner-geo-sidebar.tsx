"use client";

import type { GeoBoundary, GeoBoundaryKind } from "@/lib/geo-boundaries-types";
import { GEO_BOUNDARY_KIND_LABELS } from "@/lib/geo-boundaries-types";
import type { GeoCatalogItem } from "@/hooks/use-visit-planner-catalog";
import { ChevronDown, MapPinned } from "lucide-react";

type Props = {
  expanded: boolean;
  onToggleExpanded: () => void;
  kind: GeoBoundaryKind;
  onKindChange: (k: GeoBoundaryKind) => void;
  refId: string;
  onRefIdChange: (id: string) => void;
  itemsByKind: Record<GeoBoundaryKind, GeoCatalogItem[]>;
  selectedBoundary: GeoBoundary | null;
  drawActive: boolean;
  drawPointCount: number;
  saving: boolean;
  onStartDraw: () => void;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  onDeleteBoundary: () => void;
  onAssignClients: () => void;
  clientsInArea: number;
};

export function VisitPlannerGeoSidebar({
  expanded,
  onToggleExpanded,
  kind,
  onKindChange,
  refId,
  onRefIdChange,
  itemsByKind,
  selectedBoundary,
  drawActive,
  drawPointCount,
  saving,
  onStartDraw,
  onFinishDraw,
  onCancelDraw,
  onDeleteBoundary,
  onAssignClients,
  clientsInArea
}: Props) {
  const items = itemsByKind[kind] ?? [];
  const selectedItem = items.find((i) => i.ref_id === refId);
  const hasPolygon = Boolean(selectedBoundary && selectedBoundary.polygon.length >= 3);
  const summary = selectedItem?.name ?? "Tanlanmagan";

  return (
    <div className={`vp-geo-bar${expanded ? " vp-geo-bar-open" : ""}`}>
      <button type="button" className="vp-geo-toggle" onClick={onToggleExpanded} aria-expanded={expanded}>
        <MapPinned className="size-4 shrink-0 text-violet-600" aria-hidden />
        <span className="vp-geo-toggle-label">Hudud</span>
        <span className="vp-geo-toggle-value">{summary}</span>
        {hasPolygon ? <span className="vp-geo-badge">{clientsInArea} klient</span> : null}
        <ChevronDown className={`vp-geo-chevron size-4 shrink-0${expanded ? " vp-open" : ""}`} aria-hidden />
      </button>

      {expanded ? (
        <div className="vp-geo-panel">
          <p className="vp-geo-hint">
            Filial / zona / territoriya tanlang, xaritada chegara chizing (kamida 3 nuqta). Ichidagi klientlar
            avtomatik ko‘rinadi.
          </p>

          <div className="vp-geo-row">
            <div className="vp-geo-tabs">
              {(["branch", "zone", "territory"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`vp-geo-tab${kind === k ? " vp-active" : ""}`}
                  onClick={() => {
                    onKindChange(k);
                    onRefIdChange("");
                  }}
                >
                  {GEO_BOUNDARY_KIND_LABELS[k]}
                </button>
              ))}
            </div>

            <label className="vp-geo-label vp-geo-label-inline">
              <span>{GEO_BOUNDARY_KIND_LABELS[kind]}</span>
              <select className="vp-native" value={refId} onChange={(e) => onRefIdChange(e.target.value)}>
                <option value="">— Tanlang —</option>
                {items.map((it) => (
                  <option key={it.ref_id} value={it.ref_id}>
                    {it.name}
                    {it.subtitle ? ` (${it.subtitle})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {items.length === 0 ? (
            <p className="vp-geo-warn">
              Tizimda {GEO_BOUNDARY_KIND_LABELS[kind].toLowerCase()} topilmadi. Sozlamalarda yarating.
            </p>
          ) : null}

          {selectedItem ? (
            <div className="vp-geo-status">
              <div>
                <b>{selectedItem.name}</b>
                <span>
                  {hasPolygon
                    ? `Chegara chizilgan · ${selectedBoundary!.polygon.length} nuqta`
                    : "Chegara hali chizilmagan"}
                </span>
              </div>
            </div>
          ) : null}

          <div className="vp-geo-actions vp-geo-actions-row">
            {!drawActive ? (
              <button type="button" className="vp-btn vp-primary" disabled={!refId || saving} onClick={onStartDraw}>
                {hasPolygon ? "Qayta chizish" : "Hudud chizish"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="vp-btn vp-green"
                  disabled={drawPointCount < 3 || saving}
                  onClick={onFinishDraw}
                >
                  {saving ? "Saqlanmoqda…" : `Saqlash (${drawPointCount})`}
                </button>
                <button type="button" className="vp-btn" onClick={onCancelDraw}>
                  Bekor
                </button>
              </>
            )}
            {hasPolygon ? (
              <>
                <button type="button" className="vp-btn" disabled={saving} onClick={onAssignClients}>
                  Klientlarni bog‘lash
                </button>
                <button type="button" className="vp-btn vp-danger" disabled={saving} onClick={onDeleteBoundary}>
                  O‘chirish
                </button>
              </>
            ) : null}
          </div>

          {drawActive ? (
            <p className="vp-geo-draw-hint">Xaritada nuqtalarni bosing (kamida 3). Chegaralar rang bilan ajratiladi.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
