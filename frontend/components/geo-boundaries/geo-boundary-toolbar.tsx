"use client";

import { usePermissions } from "@/lib/use-permissions";
import { cn } from "@/lib/utils";
import type { GeoCatalogItem } from "@/hooks/use-visit-planner-catalog";
import type { GeoBoundaryTab } from "@/lib/geo-territory-layers";
import type { BoundaryDrawStyle, GeoBoundary } from "@/components/geo-boundaries/use-geo-boundary-editor-state";

type Props = {
  activeTab: GeoBoundaryTab;
  onTabChange: (tab: GeoBoundaryTab) => void;
  layerLabels: Record<"zona" | "oblast" | "gorod", string>;
  refId: string;
  onRefIdChange: (id: string) => void;
  tabItems: GeoCatalogItem[];
  selectedBoundary: GeoBoundary | null;
  effectiveColor: string;
  customColor: string;
  onCustomColorChange: (color: string) => void;
  drawActive: boolean;
  drawStyle: BoundaryDrawStyle;
  onDrawStyleChange: (style: BoundaryDrawStyle) => void;
  drawPointCount: number;
  saving: boolean;
  canManualDraw: boolean;
  usesAdminBoundary: boolean;
  hasSavedPolygon: boolean;
  hasAdminPolygon: boolean;
  onStartDraw: () => void;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  onUndoLastPoint: () => void;
  onApplyAdminBoundary: () => void;
  onDeleteBoundary: () => void;
  onAssignClients: () => void;
  showZoneLinks?: boolean;
  warehouseId?: string;
  onWarehouseIdChange?: (id: string) => void;
  cashDeskId?: string;
  onCashDeskIdChange?: (id: string) => void;
  warehouses?: { id: number; name: string; code?: string | null }[];
  cashDesks?: { id: number; name: string; code?: string | null }[];
  onSaveZoneLinks?: () => void;
};

const TAB_LABELS: Record<GeoBoundaryTab, string> = {
  branch: "Филиал",
  zona: "Зона",
  oblast: "Область",
  gorod: "Город"
};

export function GeoBoundaryToolbar({
  activeTab,
  onTabChange,
  layerLabels,
  refId,
  onRefIdChange,
  tabItems,
  selectedBoundary,
  effectiveColor,
  customColor,
  onCustomColorChange,
  drawActive,
  drawStyle,
  onDrawStyleChange,
  drawPointCount,
  saving,
  canManualDraw,
  usesAdminBoundary,
  hasSavedPolygon,
  hasAdminPolygon,
  onStartDraw,
  onFinishDraw,
  onCancelDraw,
  onUndoLastPoint,
  onApplyAdminBoundary,
  onDeleteBoundary,
  onAssignClients,
  showZoneLinks,
  warehouseId = "",
  onWarehouseIdChange,
  cashDeskId = "",
  onCashDeskIdChange,
  warehouses = [],
  cashDesks = [],
  onSaveZoneLinks
}: Props) {
  const { has } = usePermissions();
  const canAssign = has("settings.geo_granitsy.assign");
  const canDelete = has("settings.geo_granitsy.void");
  const selectedItem = tabItems.find((i) => i.ref_id === refId);
  const tabLabel =
    activeTab === "branch" ? TAB_LABELS.branch : layerLabels[activeTab] || TAB_LABELS[activeTab];

  const tabs: GeoBoundaryTab[] = ["branch", "zona", "oblast", "gorod"];

  return (
    <div className="vp-geo-toolbar">
      <div className="vp-geo-toolbar-filters">
        <div className="vp-geo-tabs vp-geo-tabs-inline">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`vp-geo-tab${activeTab === tab ? " vp-active" : ""}`}
              disabled={drawActive}
              onClick={() => onTabChange(tab)}
            >
              {tab === "branch" ? TAB_LABELS.branch : layerLabels[tab] || TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <label className="vp-geo-toolbar-field">
          <select
            className="vp-native"
            value={refId}
            onChange={(e) => onRefIdChange(e.target.value)}
            disabled={drawActive}
          >
            <option value="">— {tabLabel} —</option>
            {tabItems.map((it) => (
              <option key={it.ref_id} value={it.ref_id}>
                {it.name}
                {it.subtitle ? ` (${it.subtitle})` : ""}
              </option>
            ))}
          </select>
        </label>

        {canManualDraw ? (
          <div className="vp-geo-tabs vp-geo-tabs-inline">
            <button
              type="button"
              className={`vp-geo-tab${drawStyle === "lasso" ? " vp-active" : ""}`}
              disabled={drawActive}
              onClick={() => onDrawStyleChange("lasso")}
            >
              Курсор
            </button>
            <button
              type="button"
              className={`vp-geo-tab${drawStyle === "click" ? " vp-active" : ""}`}
              disabled={drawActive}
              onClick={() => onDrawStyleChange("click")}
            >
              Точки
            </button>
          </div>
        ) : null}

        <label className="vp-geo-toolbar-color" title="Цвет границы">
          <input
            type="color"
            value={customColor || effectiveColor}
            onChange={(e) => onCustomColorChange(e.target.value)}
            className="vp-geo-color-input"
            disabled={drawActive}
          />
        </label>

        {selectedItem ? (
          <span className="vp-geo-toolbar-status">
            {usesAdminBoundary
              ? hasSavedPolygon
                ? "Государственная граница сохранена"
                : hasAdminPolygon
                  ? "Государственная граница"
                  : "Не найдено"
              : hasSavedPolygon
                ? `Точек: ${selectedBoundary!.polygon.length}`
                : "Не нарисована"}
          </span>
        ) : null}

        {showZoneLinks && refId ? (
          <>
            <label className="vp-geo-toolbar-field">
              <select
                className="vp-native"
                value={warehouseId}
                onChange={(e) => onWarehouseIdChange?.(e.target.value)}
                disabled={drawActive}
              >
                <option value="">— Склад —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={String(w.id)}>
                    {w.name}
                    {w.code ? ` (${w.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="vp-geo-toolbar-field">
              <select
                className="vp-native"
                value={cashDeskId}
                onChange={(e) => onCashDeskIdChange?.(e.target.value)}
                disabled={drawActive}
              >
                <option value="">— Касса —</option>
                {cashDesks.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.code ? ` (${d.code})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>

      <div className="vp-geo-toolbar-actions">
        {usesAdminBoundary && !drawActive ? (
          <button
            type="button"
            className="vp-btn vp-primary"
            disabled={!refId || saving || !hasAdminPolygon}
            onClick={onApplyAdminBoundary}
          >
            {hasSavedPolygon ? "Обновить государственную границу" : "Применить государственную границу"}
          </button>
        ) : null}

        {canManualDraw && !drawActive ? (
          <button type="button" className="vp-btn vp-primary" disabled={!refId || saving} onClick={onStartDraw}>
            {hasSavedPolygon ? "Перерисовать" : "Нарисовать"}
          </button>
        ) : null}

        {drawActive ? (
          <>
            <button
              type="button"
              className="vp-btn vp-green"
              disabled={drawPointCount < 3 || saving}
              onClick={onFinishDraw}
            >
              {saving ? "…" : `Сохранить (${drawPointCount})`}
            </button>
            <button type="button" className="vp-btn" onClick={onCancelDraw}>
              Отмена
            </button>
            {drawStyle === "click" && drawPointCount > 0 ? (
              <button type="button" className="vp-btn" onClick={onUndoLastPoint}>
                −1
              </button>
            ) : null}
          </>
        ) : null}

        {hasSavedPolygon && !drawActive ? (
          <>
            {showZoneLinks ? (
              <button type="button" className="vp-btn" disabled={saving} onClick={onSaveZoneLinks}>
                Склад/Касса
              </button>
            ) : null}
            <button type="button" className={cn("vp-btn", !canAssign && "hidden")} disabled={saving} onClick={onAssignClients}>
              Привязать
            </button>
            <button type="button" className={cn("vp-btn vp-danger", !canDelete && "hidden")} disabled={saving} onClick={onDeleteBoundary}>
              Удалить
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
