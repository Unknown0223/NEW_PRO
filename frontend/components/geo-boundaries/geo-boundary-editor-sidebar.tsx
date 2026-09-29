"use client";

import type { GeoBoundaryKind } from "@/lib/geo-boundaries-types";
import { GEO_BOUNDARY_KIND_LABELS } from "@/lib/geo-boundaries-types";
import type { GeoCatalogItem } from "@/hooks/use-visit-planner-catalog";
import type { BoundaryDrawStyle, GeoBoundary } from "@/components/geo-boundaries/use-geo-boundary-editor-state";
import { ChevronDown, MapPinned } from "lucide-react";

type Props = {
  layout?: "compact" | "settings";
  expanded: boolean;
  onToggleExpanded: () => void;
  kind: GeoBoundaryKind;
  onKindChange: (k: GeoBoundaryKind) => void;
  refId: string;
  onRefIdChange: (id: string) => void;
  itemsByKind: Record<GeoBoundaryKind, GeoCatalogItem[]>;
  selectedBoundary: GeoBoundary | null;
  effectiveColor: string;
  customColor: string;
  onCustomColorChange: (color: string) => void;
  drawActive: boolean;
  drawStyle: BoundaryDrawStyle;
  onDrawStyleChange: (style: BoundaryDrawStyle) => void;
  drawPointCount: number;
  saving: boolean;
  onStartDraw: () => void;
  onFinishDraw: () => void;
  onCancelDraw: () => void;
  onUndoLastPoint: () => void;
  onDeleteBoundary: () => void;
  onAssignClients: () => void;
};

export function GeoBoundaryEditorSidebar({
  layout = "compact",
  expanded,
  onToggleExpanded,
  kind,
  onKindChange,
  refId,
  onRefIdChange,
  itemsByKind,
  selectedBoundary,
  effectiveColor,
  customColor,
  onCustomColorChange,
  drawActive,
  drawStyle,
  onDrawStyleChange,
  drawPointCount,
  saving,
  onStartDraw,
  onFinishDraw,
  onCancelDraw,
  onUndoLastPoint,
  onDeleteBoundary,
  onAssignClients
}: Props) {
  const items = itemsByKind[kind] ?? [];
  const selectedItem = items.find((i) => i.ref_id === refId);
  const hasPolygon = Boolean(selectedBoundary && selectedBoundary.polygon.length >= 3);
  const summary = selectedItem?.name ?? "Не выбрано";
  const panelOpen = layout === "settings" ? true : expanded;

  const panel = (
    <div className="vp-geo-panel">
      <p className="vp-geo-hint">
        Выберите филиал, зону или территорию. Способ рисования — курсором или по точкам, как на карте визитов.
      </p>

      <div className="vp-geo-row">
        <div className="vp-geo-tabs">
          <button
            type="button"
            className={`vp-geo-tab${drawStyle === "lasso" ? " vp-active" : ""}`}
            disabled={drawActive}
            onClick={() => onDrawStyleChange("lasso")}
          >
            Курсором
          </button>
          <button
            type="button"
            className={`vp-geo-tab${drawStyle === "click" ? " vp-active" : ""}`}
            disabled={drawActive}
            onClick={() => onDrawStyleChange("click")}
          >
            По точкам
          </button>
        </div>
      </div>

      <div className="vp-geo-row">
        <div className="vp-geo-tabs">
          {(["branch", "zone", "territory"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`vp-geo-tab${kind === k ? " vp-active" : ""}`}
              onClick={() => onKindChange(k)}
            >
              {GEO_BOUNDARY_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <label className="vp-geo-label vp-geo-label-inline">
          <span>{GEO_BOUNDARY_KIND_LABELS[kind]}</span>
          <select className="vp-native" value={refId} onChange={(e) => onRefIdChange(e.target.value)}>
            <option value="">— Выберите —</option>
            {items.map((it) => (
              <option key={it.ref_id} value={it.ref_id}>
                {it.name}
                {it.subtitle ? ` (${it.subtitle})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="vp-geo-label vp-geo-label-inline vp-geo-color-field">
          <span>Цвет</span>
          <div className="vp-geo-color-row">
            <input
              type="color"
              value={customColor || effectiveColor}
              onChange={(e) => onCustomColorChange(e.target.value)}
              className="vp-geo-color-input"
              title="Цвет границы"
            />
            <button type="button" className="vp-btn vp-geo-color-reset" onClick={() => onCustomColorChange("")}>
              Авто
            </button>
          </div>
        </label>
      </div>

      {items.length === 0 ? (
        <p className="vp-geo-warn">
          В системе не найдено: {GEO_BOUNDARY_KIND_LABELS[kind].toLowerCase()}. Создайте в настройках территорий или
          филиалов.
        </p>
      ) : null}

      {selectedItem ? (
        <div className="vp-geo-status">
          <div>
            <b>{selectedItem.name}</b>
            <span>
              {hasPolygon
                ? `Граница нарисована · точек: ${selectedBoundary!.polygon.length}`
                : "Граница ещё не нарисована"}
            </span>
          </div>
        </div>
      ) : null}

      <div className="vp-geo-actions vp-geo-actions-row">
        {!drawActive ? (
          <button
            type="button"
            className="vp-btn vp-primary vp-geo-draw-btn"
            disabled={!refId || saving}
            onClick={onStartDraw}
          >
            {hasPolygon ? "Перерисовать" : "Нарисовать область"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="vp-btn vp-green vp-geo-draw-btn"
              disabled={drawPointCount < 3 || saving}
              onClick={onFinishDraw}
            >
              {saving ? "Сохранение…" : `Сохранить (точек: ${drawPointCount})`}
            </button>
            <button type="button" className="vp-btn" onClick={onCancelDraw}>
              Отмена
            </button>
            {drawStyle === "click" && drawPointCount > 0 ? (
              <button type="button" className="vp-btn" onClick={onUndoLastPoint}>
                Убрать последнюю точку
              </button>
            ) : null}
          </>
        )}
        {hasPolygon ? (
          <>
            <button type="button" className="vp-btn" disabled={saving} onClick={onAssignClients}>
              Привязать клиентов
            </button>
            <button type="button" className="vp-btn vp-danger" disabled={saving} onClick={onDeleteBoundary}>
              Удалить
            </button>
          </>
        ) : null}
      </div>

      {drawActive ? (
        <p className="vp-geo-draw-hint">
          {drawStyle === "lasso"
            ? "Обведите область на карте курсором — после отпускания кнопки граница будет применена (как на карте визитов)."
            : "Кликайте по карте, чтобы ставить точки (минимум 3). Перетаскивание карты отключено."}
        </p>
      ) : refId ? (
        <p className="vp-geo-draw-hint vp-geo-draw-hint-muted">
          Нажмите «Нарисовать область», затем {drawStyle === "lasso" ? "обведите курсором" : "поставьте точки"}.
        </p>
      ) : null}
    </div>
  );

  if (layout === "settings") {
    return (
      <div className="vp-geo-bar vp-geo-bar-settings">
        <div className="vp-geo-settings-head">
          <MapPinned className="size-4 shrink-0 text-violet-600" aria-hidden />
          <div>
            <b>Управление границами</b>
            <span>{summary}</span>
          </div>
        </div>
        {panel}
      </div>
    );
  }

  return (
    <div className={`vp-geo-bar${panelOpen ? " vp-geo-bar-open" : ""}`}>
      <button type="button" className="vp-geo-toggle" onClick={onToggleExpanded} aria-expanded={panelOpen}>
        <MapPinned className="size-4 shrink-0 text-violet-600" aria-hidden />
        <span className="vp-geo-toggle-label">Граница</span>
        <span className="vp-geo-toggle-value">{summary}</span>
        {hasPolygon ? (
          <span className="vp-geo-color-swatch" style={{ background: effectiveColor }} title="Цвет границы" />
        ) : null}
        <ChevronDown className={`vp-geo-chevron size-4 shrink-0${panelOpen ? " vp-open" : ""}`} aria-hidden />
      </button>

      {panelOpen ? panel : null}
    </div>
  );
}
