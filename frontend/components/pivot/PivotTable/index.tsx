"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import type {
  PivotCell as PivotCellType,
  PivotConfig,
  PivotData,
  PivotField,
  PivotFilter,
  CustomizeCellFn
} from "@salec/pivot-engine";
import { getFieldMembers, getPivotStrings, resolvePivotValueLabel } from "@salec/pivot-engine";
import { FilterEditor } from "@/components/pivot/PivotFilters";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { formatPivotMemberLabel } from "@/lib/pivot-member-labels";
import { PivotRowView } from "./PivotRow";
import { resolveClassicLabels } from "./PivotRow";
import { PivotCell } from "./PivotCell";
import { cn } from "@/lib/utils";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import { flattenPivotRowsLocal, type LocalFlatPivotRowItem } from "@/lib/pivot-flatten";
import {
  flatColumnIdsFromConfig,
  headerDragActivated,
  moveFieldId,
  parseHeaderDragTarget,
  type HeaderDragPayload,
  type HeaderDragZone
} from "@/lib/pivot-header-reorder";
import {
  buildPivotColumnKeys,
  computeSelectionStats,
  copyPivotSelection,
  extractValueColumnKeys,
  getSelectionVisual,
  getSpanSelectionVisual,
  isCoordInSelection,
  selectionRangePixelRect,
  type RangeSelection
} from "./selection";
import { selectionCellClassNames } from "./selectionStyles";
import { resolveHeaderFilterFieldId } from "./headerFields";
import {
  COL_GUTTER_H,
  DEFAULT_COL_WIDTH,
  DEFAULT_ROW_HEIGHT,
  ROW_GUTTER_W,
  computePivotColumnWidths,
  computeRowDimLefts,
  isStickyRowDimLeft
} from "./columnSizing";
import {
  EMPTY_COL_WIDTH,
  EMPTY_SHEET_COLS,
  EMPTY_SHEET_ROWS,
  buildSelectionColumnKeys,
  columnGuideGradient,
  dataColsSelectionOverlay,
  emptySheetBufferWidth,
  emptySheetRowNumber,
  headerSheetRowNumber,
  hitDataColKeyByWidths,
  isEmptySheetColKey,
  isEmptySheetRowIndex,
  sheetHeaderBandRows,
  sheetRowNumber
} from "./sheetBuffer";
import { SheetBufferBodyCell, SheetBufferHeaderCell } from "./SheetBufferCell";
import styles from "./pivot-grid.module.css";
import {
  getPivotTableStyle,
  pivotTableStyleCssVars,
  DEFAULT_PIVOT_TABLE_STYLE_ID
} from "@/lib/pivot-table-styles";
import { getPortablePivotThemeCssVars } from "@/lib/pivot-portable-themes";

/** Klassik blank uchun: oldingi data-qatorning to‘liq pathLabels. */
function previousClassicPathLabels(
  flatRows: LocalFlatPivotRowItem[],
  idx: number
): string[] | null {
  for (let i = idx - 1; i >= 0; i--) {
    const item = flatRows[i];
    if (item?.type === "row") return item.pathLabels;
  }
  return null;
}

const VIRTUAL_THRESHOLD = 80;
/** Ustun kengligi uchun to‘liq flatRows o‘rniga namuna (katta jadvalda sekinlashmasin). */
const WIDTH_SAMPLE_MAX_ROWS = 400;

type Props = {
  data: PivotData;
  config: PivotConfig;
  expandedRows: Set<string>;
  onToggleRow: (key: string) => void;
  onSort?: (fieldId: string) => void;
  onCellDoubleClick?: (cell: PivotCellType) => void;
  customizeCell?: CustomizeCellFn;
  /** Klassik sxema sarlavhalari uchun */
  fields?: PivotField[];
  /** Member filter uchun manba qatorlar */
  rawData?: Record<string, unknown>[];
  onSetFilter?: (filter: PivotFilter | null, fieldId?: string) => void;
  /** Klassik/kompakt: rows zonasidagi maydonlarni sudrab almashtirish */
  onReorderRowFields?: (fieldIds: string[]) => void;
  /** Flat: jadval ustunlarini sudrab almashtirish */
  onReorderFlatColumns?: (fieldIds: string[]) => void;
  /** Values (o‘lchovlar) tartibini sudrab almashtirish */
  onReorderValueFields?: (fieldIds: string[]) => void;
  /** Columns zonasidagi maydonlarni sudrab almashtirish */
  onReorderColumnFields?: (fieldIds: string[]) => void;
  /** Scroll oxiriga yaqinlashganda (load-more). */
  onNearEnd?: () => void;
  className?: string;
  /** Excel-like «умная таблица» style id (see pivot-table-styles). */
  tableStyleId?: string;
};

export type PivotTableHandle = {
  copySelection: () => Promise<boolean>;
  clearSelection: () => void;
  hasSelection: () => boolean;
};

export const PivotTable = forwardRef<PivotTableHandle, Props>(function PivotTable(
  {
    data,
    config,
    expandedRows,
    onToggleRow,
    onSort,
    onCellDoubleClick,
    customizeCell,
    fields,
    rawData,
    onSetFilter,
    onReorderRowFields,
    onReorderFlatColumns,
    onReorderValueFields,
    onReorderColumnFields,
    onNearEnd,
    className,
    tableStyleId = DEFAULT_PIVOT_TABLE_STYLE_ID
  },
  ref
) {
  const t = getPivotStrings();
  const tableStyle = useMemo(() => getPivotTableStyle(tableStyleId), [tableStyleId]);
  const tableStyleVars = useMemo(() => {
    const portable = getPortablePivotThemeCssVars(tableStyleId);
    if (portable) return portable;
    return pivotTableStyleCssVars(tableStyle);
  }, [tableStyleId, tableStyle]);
  const bandedRowsEnabled = tableStyle.tokens.rowBand != null;
  const layoutForm = resolveLayoutForm(config.options);
  const isFlat = layoutForm === "flat";
  const isClassic = layoutForm === "classic" && config.rows.length > 1;
  /** Compact: daraxt + har row field alohida ustun (bitta «Группа» emas). */
  const isCompactMulti = layoutForm === "compact" && config.rows.length > 1;
  const useRowDimColumns = isClassic || isCompactMulti;
  const tableSizes = config.options.tableSizes;
  const rowHeight = tableSizes?.defaultRowHeight ?? DEFAULT_ROW_HEIGHT;
  const defaultColWidth = tableSizes?.defaultColumnWidth ?? DEFAULT_COL_WIDTH;
  const columnWidthOverrides = tableSizes?.columnWidths;
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(COL_GUTTER_H + DEFAULT_ROW_HEIGHT);
  const [containerWidth, setContainerWidth] = useState(0);
  const hasRowLabel = data.rows[0]?.cells.some((c) => c.columnKey === "__row_label__");
  const [selection, setSelection] = useState<RangeSelection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cell?: PivotCellType | null;
    rowKey?: string;
  } | null>(null);
  const [filterPopup, setFilterPopup] = useState<{ fieldId: string } | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  useFocusTrap(Boolean(filterPopup), filterPopoverRef);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const didDragRef = useRef(false);
  const selectionRef = useRef<RangeSelection | null>(null);
  selectionRef.current = selection;
  const filtersByField = useMemo(() => {
    const map = new Map<string, PivotFilter>();
    for (const f of config.filters) map.set(f.fieldId, f);
    return map;
  }, [config.filters]);
  const fieldMap = useMemo(() => new Map((fields ?? []).map((f) => [f.id, f])), [fields]);
  const filterEnabled = Boolean(onSetFilter && rawData && fields?.length);
  const flatColumnIds = useMemo(
    () => flatColumnIdsFromConfig(config),
    [config.rows, config.columns, config.values]
  );
  const [headerDragOver, setHeaderDragOver] = useState<HeaderDragPayload | null>(null);
  const [headerDragging, setHeaderDragging] = useState<HeaderDragPayload | null>(null);
  const headerDragDidMoveRef = useRef(false);
  const headerPointerDragRef = useRef<{
    zone: HeaderDragZone;
    fieldId: string;
    startX: number;
    startY: number;
    activated: boolean;
    pointerId: number;
  } | null>(null);

  const applyHeaderReorder = useCallback(
    (zone: HeaderDragZone, fromId: string, toId: string) => {
      if (zone === "rows" && onReorderRowFields) {
        const next = moveFieldId(config.rows, fromId, toId);
        if (next) onReorderRowFields(next);
        return;
      }
      if (zone === "flat" && onReorderFlatColumns) {
        // Flat headers show rows+columns+values — reorder that full list, not just rows.
        const next = moveFieldId(flatColumnIds, fromId, toId);
        if (next) onReorderFlatColumns(next);
        return;
      }
      if (zone === "values" && onReorderValueFields) {
        const ids = config.values.map((v) => v.fieldId);
        const next = moveFieldId(ids, fromId, toId);
        if (next) onReorderValueFields(next);
        return;
      }
      if (zone === "columns" && onReorderColumnFields) {
        const next = moveFieldId(config.columns, fromId, toId);
        if (next) onReorderColumnFields(next);
      }
    },
    [
      config.columns,
      config.rows,
      config.values,
      flatColumnIds,
      onReorderColumnFields,
      onReorderFlatColumns,
      onReorderRowFields,
      onReorderValueFields
    ]
  );

  const canDragZone = useCallback(
    (zone: HeaderDragZone) => {
      if (zone === "rows") return Boolean(onReorderRowFields) && config.rows.length > 1;
      if (zone === "flat") return Boolean(onReorderFlatColumns) && flatColumnIds.length > 1;
      if (zone === "values") return Boolean(onReorderValueFields) && config.values.length > 1;
      if (zone === "columns") return Boolean(onReorderColumnFields) && config.columns.length > 1;
      return false;
    },
    [
      config.columns.length,
      config.rows.length,
      config.values.length,
      flatColumnIds.length,
      onReorderColumnFields,
      onReorderFlatColumns,
      onReorderRowFields,
      onReorderValueFields
    ]
  );

  const endHeaderPointerDrag = useCallback((pointerId?: number) => {
    const drag = headerPointerDragRef.current;
    if (drag && pointerId != null) {
      const nodes = hostRef.current?.querySelectorAll?.(
        `[data-pg-header-drag-zone="${drag.zone}"][data-pg-header-drag-field="${drag.fieldId}"]`
      );
      nodes?.forEach((node) => {
        const el = node as HTMLElement;
        if (el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
      });
    }
    headerPointerDragRef.current = null;
    setHeaderDragging(null);
    setHeaderDragOver(null);
  }, []);

  const headerDragProps = useCallback(
    (zone: HeaderDragZone, fieldId: string) => {
      if (!canDragZone(zone) || !fieldId) return {};
      const isOver =
        headerDragOver?.zone === zone && headerDragOver.fieldId === fieldId;
      const isSource =
        headerDragging?.zone === zone && headerDragging.fieldId === fieldId;
      return {
        title: "Перетащите, чтобы изменить порядок столбцов",
        className: cn(
          styles.thDraggable,
          isOver && styles.thDragOver,
          isSource && styles.thDragging
        ),
        "data-pg-header-drag-zone": zone,
        "data-pg-header-drag-field": fieldId,
        onPointerDown: (e: React.PointerEvent<HTMLTableCellElement>) => {
          if (e.button !== 0) return;
          if ((e.target as HTMLElement | null)?.closest?.(`[data-pg-header-filter="1"]`)) {
            return;
          }
          headerDragDidMoveRef.current = false;
          headerPointerDragRef.current = {
            zone,
            fieldId,
            startX: e.clientX,
            startY: e.clientY,
            activated: false,
            pointerId: e.pointerId
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e: React.PointerEvent<HTMLTableCellElement>) => {
          const drag = headerPointerDragRef.current;
          if (!drag || drag.zone !== zone || drag.fieldId !== fieldId) return;
          if (drag.pointerId !== e.pointerId) return;
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          if (!drag.activated) {
            if (!headerDragActivated(dx, dy)) return;
            drag.activated = true;
            headerDragDidMoveRef.current = true;
            setHeaderDragging({ zone, fieldId });
          }
          // Temporarily release hit-testing on source so elementFromPoint sees the target th.
          const prevEvents = e.currentTarget.style.pointerEvents;
          e.currentTarget.style.pointerEvents = "none";
          const under = document.elementFromPoint(e.clientX, e.clientY);
          e.currentTarget.style.pointerEvents = prevEvents;
          const target = parseHeaderDragTarget(under);
          if (target && target.zone === zone && target.fieldId !== fieldId) {
            setHeaderDragOver(target);
          } else {
            setHeaderDragOver(null);
          }
        },
        onPointerUp: (e: React.PointerEvent<HTMLTableCellElement>) => {
          const drag = headerPointerDragRef.current;
          if (!drag || drag.pointerId !== e.pointerId) return;
          const activated = drag.activated;
          const fromId = drag.fieldId;
          const fromZone = drag.zone;
          // Same hit-test trick as move.
          const prevEvents = e.currentTarget.style.pointerEvents;
          e.currentTarget.style.pointerEvents = "none";
          const under = document.elementFromPoint(e.clientX, e.clientY);
          e.currentTarget.style.pointerEvents = prevEvents;
          const target = parseHeaderDragTarget(under);
          endHeaderPointerDrag(e.pointerId);
          if (
            activated &&
            target &&
            target.zone === fromZone &&
            target.fieldId !== fromId
          ) {
            applyHeaderReorder(fromZone, fromId, target.fieldId);
          }
        },
        onPointerCancel: (e: React.PointerEvent<HTMLTableCellElement>) => {
          endHeaderPointerDrag(e.pointerId);
        },
        onLostPointerCapture: () => {
          if (headerPointerDragRef.current) {
            headerPointerDragRef.current = null;
            setHeaderDragging(null);
            setHeaderDragOver(null);
          }
        }
      };
    },
    [
      applyHeaderReorder,
      canDragZone,
      endHeaderPointerDrag,
      headerDragOver,
      headerDragging
    ]
  );

  const flatRows = useMemo(
    () =>
      flattenPivotRowsLocal(
        data.rows,
        expandedRows,
        data.grandTotal,
        data.columnTotals,
        isClassic ? "classic" : "compact",
        config.rows.length
      ),
    [data.rows, data.grandTotal, data.columnTotals, expandedRows, isClassic, config.rows.length]
  );
  const fieldLabel = useMemo(() => {
    const map = new Map((fields ?? []).map((f) => [f.id, f.label]));
    return (id: string) => map.get(id) ?? id;
  }, [fields]);

  /** Single row dim: show field caption (Агент), not generic «Группа». */
  const rowLabelHeaderCaption = useMemo(() => {
    if (useRowDimColumns || !hasRowLabel) return t.table.group;
    if (config.rows.length === 1) return fieldLabel(config.rows[0]!);
    return t.table.group;
  }, [useRowDimColumns, hasRowLabel, config.rows, fieldLabel, t.table.group]);

  /** Measure headers use value labels; dimension members use system captions (Статус → Новый). */
  const headerCaptionLabel = useCallback(
    (header: PivotData["headers"][0][0], fieldId: string | undefined) => {
      if (header.isValue) {
        if (!fieldId) return header.label;
        const valueDef = config.values.find((v) => v.fieldId === fieldId);
        if (valueDef) {
          return resolvePivotValueLabel(valueDef, fields ?? []);
        }
        return fieldLabel(fieldId);
      }
      return formatPivotMemberLabel(fieldId, header.label);
    },
    [config.values, fields, fieldLabel]
  );

  const columnKeys = useMemo(() => {
    const valueKeys = extractValueColumnKeys(flatRows, data.rows);
    return buildPivotColumnKeys(valueKeys, config.rows.length, Boolean(hasRowLabel), useRowDimColumns);
  }, [flatRows, data.rows, config.rows.length, hasRowLabel, useRowDimColumns]);

  /** Data keys + empty buffer keys so selection/copy spans the whole sheet. */
  const selectionColumnKeys = useMemo(
    () => buildSelectionColumnKeys(columnKeys, EMPTY_SHEET_COLS),
    [columnKeys]
  );

  const measuredWidths = useMemo(() => {
    const bodySamplesByKey = new Map<string, string[]>();
    const rowDimSamples: string[][] = config.rows.map(() => []);
    const rowLabelSamples: string[] = [];
    let sampledRows = 0;

    const pushUnique = (arr: string[], value: string) => {
      if (!value) return;
      // Keep a small set of longest candidates (length proxy + later measured).
      if (arr.length < 24) {
        arr.push(value);
        return;
      }
      let shortestIdx = 0;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i]!.length < arr[shortestIdx]!.length) shortestIdx = i;
      }
      if (value.length > arr[shortestIdx]!.length) arr[shortestIdx] = value;
    };

    for (const item of flatRows) {
      if (sampledRows >= WIDTH_SAMPLE_MAX_ROWS) break;
      if (item.type === "row") {
        sampledRows += 1;
        const cells = item.row.cells;
        if (useRowDimColumns) {
          const labels = resolveClassicLabels(
            item.pathLabels,
            item.row,
            item.depth,
            config.rows.length
          );
          labels.forEach((lab, i) => {
            if (i < rowDimSamples.length) pushUnique(rowDimSamples[i]!, String(lab ?? ""));
          });
        } else {
          // Engine top-level rows may leave formatted empty; UI shows row.key.
          const lab = cells.find((c) => c.columnKey === "__row_label__");
          const shown = String(lab?.formatted || lab?.value || item.row.key || "");
          pushUnique(rowLabelSamples, shown);
        }
        for (const cell of cells) {
          if (cell.columnKey === "__row_label__" || cell.columnKey === "__row_label__2") continue;
          let arr = bodySamplesByKey.get(cell.columnKey);
          if (!arr) {
            arr = [];
            bodySamplesByKey.set(cell.columnKey, arr);
          }
          pushUnique(arr, String(cell.formatted ?? cell.value ?? ""));
        }
      } else {
        sampledRows += 1;
        const cells =
          item.type === "subtotal" ? item.subtotal.cells : item.total.cells;
        for (const cell of cells) {
          if (cell.columnKey === "__row_label__" || cell.columnKey === "__row_label__2") continue;
          let arr = bodySamplesByKey.get(cell.columnKey);
          if (!arr) {
            arr = [];
            bodySamplesByKey.set(cell.columnKey, arr);
          }
          pushUnique(arr, String(cell.formatted ?? cell.value ?? ""));
        }
      }
    }

    const headerLevels = data.headers.map((level, li) =>
      level
        .filter((h) => h.key !== "__row_label__" && h.key !== "__row_label__2")
        .map((h) => {
          const fieldId = resolveHeaderFilterFieldId(h, config, li, isFlat);
          return {
            key: h.key,
            // Same caption as rendered headers (value label / catalog), not raw engine id.
            label: headerCaptionLabel(h, fieldId),
            colspan: h.colspan,
            isValue: h.isValue
          };
        })
    );

    return computePivotColumnWidths({
      columnKeys,
      containerWidth: containerWidth > 0 ? containerWidth : 0,
      columnWidthOverrides,
      defaultColumnWidth: defaultColWidth,
      rowDimLabels: useRowDimColumns ? config.rows.map((id) => fieldLabel(id)) : [],
      rowDimSamples: useRowDimColumns ? rowDimSamples : [],
      rowLabelHeader: !useRowDimColumns && hasRowLabel ? rowLabelHeaderCaption : undefined,
      rowLabelSamples: !useRowDimColumns && hasRowLabel ? rowLabelSamples : [],
      headerLevels,
      bodySamplesByKey,
      rowDimHasExpand: true,
      // Empty sheet buffer fills the viewport; keep data columns content-fitted.
      stretchToFill: false
    });
  }, [
    flatRows,
    data.headers,
    columnKeys,
    containerWidth,
    columnWidthOverrides,
    defaultColWidth,
    useRowDimColumns,
    config.rows,
    config,
    fieldLabel,
    headerCaptionLabel,
    hasRowLabel,
    isFlat,
    rowLabelHeaderCaption
  ]);

  const rowDimLefts = useMemo(
    () => computeRowDimLefts(columnKeys, measuredWidths),
    [columnKeys, measuredWidths]
  );

  const lastStickyRowDimIdx = useMemo(() => {
    let last = -1;
    for (let i = 0; i < rowDimLefts.length; i++) {
      if (isStickyRowDimLeft(rowDimLefts[i])) last = i;
    }
    return last;
  }, [rowDimLefts]);

  /**
   * Always an explicit pixel width (never `width: 100%`).
   * Data columns: content-fitted mins. Empty sheet buffer (~100 cols) extends
   * the scrollable sheet so underfull layouts still look like Excel/WDR.
   */
  const tablePixelWidth = useMemo(() => {
    let sum = ROW_GUTTER_W;
    for (const k of columnKeys) sum += measuredWidths[k] ?? defaultColWidth;
    return sum + emptySheetBufferWidth(EMPTY_SHEET_COLS, EMPTY_COL_WIDTH);
  }, [columnKeys, measuredWidths, defaultColWidth]);

  const totalScrollRows = flatRows.length + EMPTY_SHEET_ROWS;
  const virtualEnabled = totalScrollRows > VIRTUAL_THRESHOLD;

  const rowDimCount = useRowDimColumns ? config.rows.length : hasRowLabel ? 1 : 0;

  const colIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    selectionColumnKeys.forEach((k, i) => map.set(k, i));
    return map;
  }, [selectionColumnKeys]);

  const copyOpts = useMemo(
    () => ({
      useRowDimColumns,
      rowFieldCount: config.rows.length,
      config
    }),
    [useRowDimColumns, config]
  );

  const copySelection = useCallback(async () => {
    return copyPivotSelection(flatRows, selectionColumnKeys, selectionRef.current, copyOpts);
  }, [flatRows, selectionColumnKeys, copyOpts]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setContextMenu(null);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      copySelection,
      clearSelection,
      hasSelection: () => selectionRef.current != null
    }),
    [copySelection, clearSelection]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectionRef.current) {
        clearSelection();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c") return;
      if (!selectionRef.current) return;
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || active.isContentEditable) return;
      }
      e.preventDefault();
      void copySelection();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelection, clearSelection]);

  useEffect(() => {
    const endDrag = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setIsDragging(false);
    };
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, []);

  useEffect(() => {
    if (!contextMenu && !filterPopup) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (filterPopup) {
        // Centered filter: backdrop / Escape / buttons close — ignore table scroll clicks.
        if (filterPopoverRef.current?.contains(t)) return;
        if ((t as HTMLElement)?.closest?.(`[data-pg-header-filter="1"]`)) return;
        return;
      }
      if (contextMenuRef.current?.contains(t)) return;
      if ((t as HTMLElement)?.closest?.(`[data-pg-header-filter="1"]`)) return;
      setContextMenu(null);
    };
    const onScroll = () => {
      if (filterPopup) return;
      setContextMenu(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setContextMenu(null);
      setFilterPopup(null);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu, filterPopup]);

  const openHeaderFilter = useCallback(
    (fieldId: string, e: React.MouseEvent) => {
      if (!filterEnabled) return;
      e.preventDefault();
      e.stopPropagation();
      setContextMenu(null);
      setFilterPopup({ fieldId });
    },
    [filterEnabled]
  );
  const beginSelect = useCallback(
    (rowIndex: number, columnKey: string, e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const colIndex = colIndexByKey.get(columnKey);
      if (colIndex == null) return;
      e.preventDefault();
      const coord = { rowIndex, colIndex };
      didDragRef.current = false;
      if (e.shiftKey && selectionRef.current) {
        setSelection({ anchor: selectionRef.current.anchor, focus: coord });
      } else {
        setSelection({ anchor: coord, focus: coord });
        draggingRef.current = true;
        setIsDragging(true);
      }
      setContextMenu(null);
    },
    [colIndexByKey]
  );

  const extendSelect = useCallback(
    (rowIndex: number, columnKey: string) => {
      if (!draggingRef.current) return;
      const colIndex = colIndexByKey.get(columnKey);
      if (colIndex == null) return;
      didDragRef.current = true;
      setSelection((prev) => {
        if (!prev) return { anchor: { rowIndex, colIndex }, focus: { rowIndex, colIndex } };
        if (prev.focus.rowIndex === rowIndex && prev.focus.colIndex === colIndex) return prev;
        return { ...prev, focus: { rowIndex, colIndex } };
      });
    },
    [colIndexByKey]
  );

  const selectCell = useCallback(
    (rowIndex: number, columnKey: string) => {
      // Click fires after drag — don't collapse the range.
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      const colIndex = colIndexByKey.get(columnKey);
      if (colIndex == null) return;
      setSelection({
        anchor: { rowIndex, colIndex },
        focus: { rowIndex, colIndex }
      });
    },
    [colIndexByKey]
  );

  const openContextMenu = useCallback(
    (rowIndex: number, columnKey: string, e: React.MouseEvent, cell?: PivotCellType | null, rowKey?: string) => {
      e.preventDefault();
      const colIndex = colIndexByKey.get(columnKey);
      if (colIndex == null) return;
      const inSel = isCoordInSelection(selectionRef.current, rowIndex, colIndex);
      if (!inSel) {
        setSelection({
          anchor: { rowIndex, colIndex },
          focus: { rowIndex, colIndex }
        });
      }
      setFilterPopup(null);
      setContextMenu({ x: e.clientX, y: e.clientY, cell: cell ?? null, rowKey });
    },
    [colIndexByKey]
  );

  const virtualizer = useVirtualizer({
    count: totalScrollRows,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    enabled: virtualEnabled
  });

  // Selection / layout o‘zgaganda eski overlay (ko‘k chiziqlar) qolmasin
  useEffect(() => {
    setSelection(null);
  }, [columnKeys.join("|"), data.rows.length, config.rows.join("|"), layoutForm]);

  const nearEndFiredRef = useRef(false);
  useEffect(() => {
    nearEndFiredRef.current = false;
  }, [data.rows.length, onNearEnd]);

  useEffect(() => {
    if (!onNearEnd) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (remaining < rowHeight * 24) {
        if (nearEndFiredRef.current) return;
        nearEndFiredRef.current = true;
        onNearEnd();
        // Keyingi page kelgach yana ruxsat
        window.setTimeout(() => {
          nearEndFiredRef.current = false;
        }, 800);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onNearEnd, rowHeight, data.rows.length]);

  const virtualItems = virtualEnabled ? virtualizer.getVirtualItems() : [];
  const padTop = virtualEnabled ? (virtualItems[0]?.start ?? 0) : 0;
  const padBottom = virtualEnabled
    ? virtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
    : 0;

  const renderIndices = virtualEnabled
    ? virtualItems.map((v) => v.index)
    : Array.from({ length: totalScrollRows }, (_, i) => i);

  const sortField = config.options.sortBy?.fieldId;
  const sortDir = config.options.sortBy?.direction;
  const rules = config.options.conditionalFormats;
  const headerLevels = Math.max(data.headers.length, 1);
  /** Field-header band occupies sheet rows 1..H; body data starts at H+1. */
  const headerBandRows = sheetHeaderBandRows(data.headers.length);
  // + row gutter + empty sheet cols (body uses one colspan cell for empty region)
  const tableColSpan = columnKeys.length + 1 + EMPTY_SHEET_COLS;

  const selectionStats = useMemo(
    () => computeSelectionStats(flatRows, selectionColumnKeys, selection, copyOpts),
    [flatRows, selectionColumnKeys, selection, copyOpts]
  );

  const selectionColWidths = useMemo(
    () =>
      selectionColumnKeys.map((k) =>
        isEmptySheetColKey(k) ? EMPTY_COL_WIDTH : (measuredWidths[k] ?? defaultColWidth)
      ),
    [selectionColumnKeys, measuredWidths, defaultColWidth]
  );

  const selectionOverlayRect = useMemo(
    () =>
      selectionRangePixelRect(selection, {
        colWidths: selectionColWidths,
        rowHeight,
        gutterWidth: ROW_GUTTER_W,
        headerHeight
      }),
    [selection, selectionColWidths, rowHeight, headerHeight]
  );

  useEffect(() => {
    const el = theadRef.current;
    if (!el) return;
    const update = () => setHeaderHeight(el.offsetHeight);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [headerLevels, data.headers.length, isFlat, useRowDimColumns]);

  const formatStat = (n: number) =>
    n.toLocaleString("ru-RU", { maximumFractionDigits: 2 });

  return (
    <div
      ref={hostRef}
      className={cn(
        styles.host,
        isFlat && styles.hostFlat,
        isDragging && styles.selecting,
        headerDragging && styles.headerReordering,
        className
      )}
      data-table-style={tableStyle.id}
      style={
        {
          ...tableStyleVars,
          "--pg-row-height": `${rowHeight}px`,
          "--pg-gutter-w": `${ROW_GUTTER_W}px`,
          "--pg-col-gutter-h": `${COL_GUTTER_H}px`
        } as React.CSSProperties
      }
      tabIndex={0}
    >
      <div ref={scrollRef} data-pivot-scroll className={cn(styles.scroll, "max-h-[inherit]")}>
        <div className={styles.tableWrap}>
        <table
          className={styles.table}
          style={{
            width: tablePixelWidth,
            minWidth: tablePixelWidth
          }}
        >
          <colgroup>
            <col style={{ width: ROW_GUTTER_W, minWidth: ROW_GUTTER_W }} />
            {columnKeys.map((k) => (
              <col
                key={`col-${k}`}
                style={{
                  width: measuredWidths[k] ?? defaultColWidth,
                  minWidth: measuredWidths[k] ?? defaultColWidth
                }}
              />
            ))}
            {Array.from({ length: EMPTY_SHEET_COLS }, (_, i) => (
              <col
                key={`empty-col-${i}`}
                style={{ width: EMPTY_COL_WIDTH, minWidth: EMPTY_COL_WIDTH }}
              />
            ))}
          </colgroup>
          <thead ref={theadRef} className={styles.thead}>
            <tr>
              <th className={styles.thGutterCorner} aria-hidden />
              {columnKeys.map((_, i) => (
                <th key={`col-gutter-${i}`} className={styles.thColGutter} aria-hidden>
                  {i + 1}
                </th>
              ))}
              {Array.from({ length: EMPTY_SHEET_COLS }, (_, i) => (
                <th key={`empty-col-gutter-${i}`} className={styles.thColGutter} aria-hidden>
                  {columnKeys.length + i + 1}
                </th>
              ))}
            </tr>
            {data.headers.length === 0 ? (
              <tr>
                <th className={styles.thRowGutter} aria-hidden>
                  {headerSheetRowNumber(0)}
                </th>
                  {useRowDimColumns
                  ? config.rows.map((fieldId, i) => {
                      const dimKey = `__row_dim_${i}__`;
                      const dimW = measuredWidths[dimKey] ?? defaultColWidth;
                      const drag = headerDragProps("rows", fieldId);
                      const sticky = isStickyRowDimLeft(rowDimLefts[i]);
                      return (
                        <th
                          key={`row-dim-h-${fieldId}`}
                          className={cn(
                            styles.th,
                            styles.thRowDim,
                            sticky && styles.thRowDimSticky,
                            sticky && i === lastStickyRowDimIdx && styles.thRowDimStickyLast,
                            onSort && styles.thSortable,
                            drag.className
                          )}
                          style={{
                            minWidth: dimW,
                            width: dimW,
                            maxWidth: dimW,
                            ...(sticky
                              ? { left: rowDimLefts[i], zIndex: 30 - i }
                              : { zIndex: 21 })
                          }}
                          data-pg-header-drag-zone={drag["data-pg-header-drag-zone"]}
                          data-pg-header-drag-field={drag["data-pg-header-drag-field"]}
                          title={drag.title}
                          onPointerDown={drag.onPointerDown}
                          onPointerMove={drag.onPointerMove}
                          onPointerUp={drag.onPointerUp}
                          onPointerCancel={drag.onPointerCancel}
                          onLostPointerCapture={drag.onLostPointerCapture}
                          onClick={() => {
                            if (headerDragDidMoveRef.current) {
                              headerDragDidMoveRef.current = false;
                              return;
                            }
                            onSort?.(fieldId);
                          }}
                        >
                          <HeaderCaption
                            label={fieldLabel(fieldId)}
                            sortMark={
                              sortField === fieldId ? (sortDir === "asc" ? "▲" : "▼") : undefined
                            }
                            filterable={filterEnabled}
                            filterActive={filtersByField.has(fieldId)}
                            onFilterClick={(e) => openHeaderFilter(fieldId, e)}
                          />
                        </th>
                      );
                    })
                  : hasRowLabel && (
                      <th
                        className={cn(
                          styles.th,
                          styles.thRowDim,
                          styles.thRowDimSticky,
                          styles.thRowDimStickyLast,
                          onSort && styles.thSortable
                        )}
                        style={{
                          left: ROW_GUTTER_W,
                          minWidth: measuredWidths["__row_label__"] ?? defaultColWidth,
                          width: measuredWidths["__row_label__"] ?? defaultColWidth,
                          maxWidth: measuredWidths["__row_label__"] ?? defaultColWidth,
                          zIndex: 30
                        }}
                        onClick={() => config.rows[0] && onSort?.(config.rows[0])}
                      >
                        <HeaderCaption
                          label={rowLabelHeaderCaption}
                          sortMark={
                            sortField === config.rows[0]
                              ? sortDir === "asc"
                                ? "▲"
                                : "▼"
                              : undefined
                          }
                          filterable={filterEnabled && Boolean(config.rows[0])}
                          filterActive={Boolean(config.rows[0] && filtersByField.has(config.rows[0]))}
                          onFilterClick={(e) => config.rows[0] && openHeaderFilter(config.rows[0], e)}
                        />
                      </th>
                    )}
                <SheetBufferHeaderCell />
              </tr>
            ) : (
              data.headers.map((level, li) => (
                <tr key={`h-${li}`}>
                  <th className={styles.thRowGutter} aria-hidden>
                    {headerSheetRowNumber(li)}
                  </th>
                  {li === 0 &&
                    (useRowDimColumns
                      ? config.rows.map((fieldId, i) => {
                          const dimKey = `__row_dim_${i}__`;
                          const dimW = measuredWidths[dimKey] ?? defaultColWidth;
                          const drag = headerDragProps("rows", fieldId);
                          const sticky = isStickyRowDimLeft(rowDimLefts[i]);
                          return (
                            <th
                              key={`row-dim-h-${fieldId}`}
                              rowSpan={headerLevels}
                              className={cn(
                                styles.th,
                                styles.thRowDim,
                                sticky && styles.thRowDimSticky,
                                sticky && i === lastStickyRowDimIdx && styles.thRowDimStickyLast,
                                onSort && styles.thSortable,
                                drag.className
                              )}
                              style={{
                                minWidth: dimW,
                                width: dimW,
                                maxWidth: dimW,
                                ...(sticky
                                  ? { left: rowDimLefts[i], zIndex: 30 - i }
                                  : { zIndex: 21 })
                              }}
                              data-pg-header-drag-zone={drag["data-pg-header-drag-zone"]}
                              data-pg-header-drag-field={drag["data-pg-header-drag-field"]}
                              title={drag.title}
                              onPointerDown={drag.onPointerDown}
                              onPointerMove={drag.onPointerMove}
                              onPointerUp={drag.onPointerUp}
                              onPointerCancel={drag.onPointerCancel}
                              onLostPointerCapture={drag.onLostPointerCapture}
                              onClick={() => {
                                if (headerDragDidMoveRef.current) {
                                  headerDragDidMoveRef.current = false;
                                  return;
                                }
                                onSort?.(fieldId);
                              }}
                            >
                              <HeaderCaption
                                label={fieldLabel(fieldId)}
                                sortMark={
                                  sortField === fieldId ? (sortDir === "asc" ? "▲" : "▼") : undefined
                                }
                                filterable={filterEnabled}
                                filterActive={filtersByField.has(fieldId)}
                                onFilterClick={(e) => openHeaderFilter(fieldId, e)}
                              />
                            </th>
                          );
                        })
                      : hasRowLabel && (
                          <th
                            rowSpan={headerLevels}
                            className={cn(
                              styles.th,
                              styles.thRowDim,
                              styles.thRowDimSticky,
                              styles.thRowDimStickyLast,
                              onSort && styles.thSortable
                            )}
                            style={{
                              left: ROW_GUTTER_W,
                              minWidth: measuredWidths["__row_label__"] ?? defaultColWidth,
                              width: measuredWidths["__row_label__"] ?? defaultColWidth,
                              maxWidth: measuredWidths["__row_label__"] ?? defaultColWidth,
                              zIndex: 30
                            }}
                            onClick={() => config.rows[0] && onSort?.(config.rows[0])}
                          >
                            <HeaderCaption
                              label={rowLabelHeaderCaption}
                              sortMark={
                                sortField === config.rows[0]
                                  ? sortDir === "asc"
                                    ? "▲"
                                    : "▼"
                                  : undefined
                              }
                              filterable={filterEnabled && Boolean(config.rows[0])}
                              filterActive={Boolean(config.rows[0] && filtersByField.has(config.rows[0]))}
                              onFilterClick={(e) => config.rows[0] && openHeaderFilter(config.rows[0], e)}
                            />
                          </th>
                        ))}
                  {level
                    .filter((h) => h.key !== "__row_label__" && h.key !== "__row_label__2")
                    .map((h) => {
                      const fieldId = resolveHeaderFilterFieldId(h, config, li, isFlat);
                      const span = Math.max(1, h.colspan || 1);
                      // Width of leaf span — prefer explicit leaf key width when colspan=1
                      const leafW =
                        span === 1
                          ? (measuredWidths[h.key] ?? defaultColWidth)
                          : undefined;
                      const dragZone: HeaderDragZone | null = isFlat
                        ? "flat"
                        : h.isValue
                          ? "values"
                          : li < config.columns.length
                            ? "columns"
                            : null;
                      const drag =
                        dragZone && fieldId && span === 1
                          ? headerDragProps(dragZone, fieldId)
                          : ({} as ReturnType<typeof headerDragProps>);
                      return (
                        <th
                          key={h.key}
                          colSpan={h.colspan}
                          rowSpan={h.rowspan}
                          className={cn(
                            styles.th,
                            h.isValue && styles.thMeasure,
                            fieldId && onSort && styles.thSortable,
                            drag.className
                          )}
                          style={
                            leafW != null
                              ? { width: leafW, minWidth: leafW }
                              : undefined
                          }
                          data-pg-header-drag-zone={drag["data-pg-header-drag-zone"]}
                          data-pg-header-drag-field={drag["data-pg-header-drag-field"]}
                          title={drag.title}
                          onPointerDown={drag.onPointerDown}
                          onPointerMove={drag.onPointerMove}
                          onPointerUp={drag.onPointerUp}
                          onPointerCancel={drag.onPointerCancel}
                          onLostPointerCapture={drag.onLostPointerCapture}
                          onClick={() => {
                            if (headerDragDidMoveRef.current) {
                              headerDragDidMoveRef.current = false;
                              return;
                            }
                            if (fieldId) onSort?.(fieldId);
                          }}
                        >
                          <HeaderCaption
                            label={headerCaptionLabel(h, fieldId)}
                            sortMark={
                              fieldId && sortField === fieldId
                                ? sortDir === "asc"
                                  ? "▲"
                                  : "▼"
                                : undefined
                            }
                            filterable={filterEnabled && Boolean(fieldId)}
                            filterActive={Boolean(fieldId && filtersByField.has(fieldId))}
                            onFilterClick={(e) => fieldId && openHeaderFilter(fieldId, e)}
                          />
                        </th>
                      );
                    })}
                  <SheetBufferHeaderCell />
                </tr>
              ))
            )}
          </thead>
          <tbody>
            {virtualEnabled && padTop > 0 && (
              <tr aria-hidden className={styles.padRow} style={{ height: padTop }}>
                <td colSpan={tableColSpan} />
              </tr>
            )}
            {renderIndices.map((idx) =>
              isEmptySheetRowIndex(idx, flatRows.length) ? (
                <EmptySheetRow
                  key={`empty-sheet-${idx}`}
                  rowIndex={idx}
                  rowNumber={emptySheetRowNumber(idx, headerBandRows)}
                  columnKeys={columnKeys}
                  columnWidths={measuredWidths}
                  defaultColWidth={defaultColWidth}
                  rowHeight={rowHeight}
                  banded={bandedRowsEnabled && idx % 2 === 1}
                  selection={selection}
                  onSelectCell={(columnKey) => selectCell(idx, columnKey)}
                  onMouseDownSelect={(columnKey, e) => beginSelect(idx, columnKey, e)}
                  onMouseEnterSelect={(columnKey) => extendSelect(idx, columnKey)}
                  onContextMenuSelect={(columnKey, e) => openContextMenu(idx, columnKey, e)}
                />
              ) : (
                <VirtualFlatRow
                  key={`${flatRows[idx]?.type}-${idx}`}
                  item={flatRows[idx]!}
                  rowIndex={idx}
                  sheetRowNumber={sheetRowNumber(idx, headerBandRows)}
                  config={config}
                  rules={rules}
                  customizeCell={customizeCell}
                  columnWidths={measuredWidths}
                  defaultColWidth={defaultColWidth}
                  rowHeight={rowHeight}
                  onToggleRow={onToggleRow}
                  onSort={onSort}
                  onCellDoubleClick={onCellDoubleClick}
                  useRowDimColumns={useRowDimColumns}
                  rowDimCount={rowDimCount}
                  expandedRows={expandedRows}
                  previousPathLabels={
                    isClassic ? previousClassicPathLabels(flatRows, idx) : null
                  }
                  selection={selection}
                  columnKeys={columnKeys}
                  dataColCount={columnKeys.length}
                  onSelectCell={selectCell}
                  onMouseDownSelect={beginSelect}
                  onMouseEnterSelect={extendSelect}
                  onContextMenuSelect={openContextMenu}
                  rowDimLefts={rowDimLefts}
                  banded={bandedRowsEnabled && flatRows[idx]?.type === "row" && idx % 2 === 1}
                />
              )
            )}
            {virtualEnabled && padBottom > 0 && (
              <tr aria-hidden className={styles.padRow} style={{ height: padBottom }}>
                <td colSpan={tableColSpan} />
              </tr>
            )}
          </tbody>
        </table>
        {selectionOverlayRect ? (
          <div
            className={styles.selectionRangeOverlay}
            aria-hidden
            style={{
              left: selectionOverlayRect.left,
              top: selectionOverlayRect.top,
              width: selectionOverlayRect.width,
              height: selectionOverlayRect.height
            }}
          />
        ) : null}
        </div>
      </div>
      <div className={styles.footer}>
        {t.table.rowsMeta(
          data.metadata.processedRows.toLocaleString("ru-RU"),
          data.metadata.executionTime.toFixed(1),
          {
            virtual: virtualEnabled ? String(flatRows.length) : undefined,
            fromCache: data.metadata.fromCache,
            incremental: data.metadata.incremental
          }
        )}
        {data.metadata.warnings.length > 0 && ` · ${data.metadata.warnings.join("; ")}`}
      </div>
      {selection && selectionStats && selectionStats.numericCount > 0 && (
        <div className={styles.selectionStats} aria-live="polite">
          <span>СР: {formatStat(selectionStats.avg)}</span>
          <span>КОЛ-ВО: {selectionStats.numericCount.toLocaleString("ru-RU")}</span>
          <span>СУММА: {formatStat(selectionStats.sum)}</span>
        </div>
      )}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            onClick={() => {
              void copySelection();
              setContextMenu(null);
            }}
          >
            Копировать
          </button>
          <div className={styles.contextMenuSep} />
          <button
            type="button"
            className={styles.contextMenuItem}
            role="menuitem"
            disabled={!contextMenu.cell?.drillContext || !onCellDoubleClick}
            onClick={() => {
              if (contextMenu.cell && onCellDoubleClick) onCellDoubleClick(contextMenu.cell);
              setContextMenu(null);
            }}
          >
            Детализация
          </button>
          {contextMenu.rowKey ? (
            <button
              type="button"
              className={styles.contextMenuItem}
              role="menuitem"
              onClick={() => {
                onToggleRow(contextMenu.rowKey!);
                setContextMenu(null);
              }}
            >
              {expandedRows.has(contextMenu.rowKey) ? "Свернуть" : "Развернуть"}
            </button>
          ) : null}
        </div>
      )}
      {filterPopup &&
      filterEnabled &&
      fieldMap.get(filterPopup.fieldId) &&
      rawData &&
      onSetFilter &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.filterPopoverHost}
              role="presentation"
              onClick={() => setFilterPopup(null)}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                ref={filterPopoverRef}
                className={styles.filterPopoverPanel}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <FilterEditor
                  field={fieldMap.get(filterPopup.fieldId)!}
                  members={getFieldMembers(rawData, filterPopup.fieldId)}
                  allFields={fields ?? []}
                  filter={filtersByField.get(filterPopup.fieldId)}
                  onApply={(filter) => {
                    onSetFilter(filter, filterPopup.fieldId);
                    setFilterPopup(null);
                  }}
                  onClose={() => setFilterPopup(null)}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
});

function HeaderCaption({
  label,
  sortMark,
  filterable,
  filterActive,
  onFilterClick
}: {
  label: string;
  sortMark?: string;
  filterable?: boolean;
  filterActive?: boolean;
  onFilterClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <span className={styles.thInner}>
      <span className={styles.thLabel}>
        {label}
        {sortMark ? <span className={styles.thSortMark}>{sortMark}</span> : null}
      </span>
      {filterable ? (
        <button
          type="button"
          data-pg-header-filter="1"
          draggable={false}
          className={cn(styles.thFilter, filterActive && styles.thFilterActive)}
          aria-label="Фильтр"
          title="Фильтр"
          onClick={onFilterClick}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      ) : null}
    </span>
  );
}

function EmptySheetRow({
  rowIndex,
  rowNumber,
  columnKeys,
  columnWidths,
  defaultColWidth,
  rowHeight,
  banded = false,
  selection,
  onSelectCell,
  onMouseDownSelect,
  onMouseEnterSelect,
  onContextMenuSelect
}: {
  rowIndex: number;
  rowNumber: number;
  columnKeys: string[];
  columnWidths: Record<string, number>;
  defaultColWidth: number;
  rowHeight: number;
  banded?: boolean;
  selection: RangeSelection | null;
  onSelectCell: (columnKey: string) => void;
  onMouseDownSelect: (columnKey: string, e: React.MouseEvent) => void;
  onMouseEnterSelect: (columnKey: string) => void;
  onContextMenuSelect: (columnKey: string, e: React.MouseEvent) => void;
}) {
  const widths = columnKeys.map((k) => columnWidths[k] ?? defaultColWidth);
  const totalW = widths.reduce((a, b) => a + b, 0);
  const resolveKey = (e: React.MouseEvent) => {
    const left = (e.currentTarget as HTMLElement).getBoundingClientRect().left;
    return hitDataColKeyByWidths(e.clientX, left, columnKeys, columnWidths, defaultColWidth);
  };
  const dataOverlay = dataColsSelectionOverlay(
    selection,
    rowIndex,
    columnKeys.length,
    widths
  );

  return (
    <tr className={cn(styles.trHover, banded && styles.trBanded)} style={{ height: rowHeight }}>
      <td className={styles.tdRowGutter} aria-hidden>
        {rowNumber}
      </td>
      {columnKeys.length > 0 ? (
        <td
          colSpan={columnKeys.length}
          className={styles.tdSheetEmpty}
          style={{
            width: totalW,
            minWidth: totalW,
            height: rowHeight,
            maxHeight: rowHeight,
            backgroundImage: columnGuideGradient(widths)
          }}
          onClick={(e) => onSelectCell(resolveKey(e))}
          onMouseDown={(e) => onMouseDownSelect(resolveKey(e), e)}
          onMouseEnter={(e) => onMouseEnterSelect(resolveKey(e))}
          onMouseMove={(e) => onMouseEnterSelect(resolveKey(e))}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenuSelect(resolveKey(e), e);
          }}
        >
          {dataOverlay ? (
            <div
              className={cn(
                styles.bufferSelOverlay,
                dataOverlay.visual.focus && styles.bufferSelOverlayFocus
              )}
              style={{ left: dataOverlay.left, width: dataOverlay.width }}
            />
          ) : null}
        </td>
      ) : null}
      <SheetBufferBodyCell
        rowIndex={rowIndex}
        dataColCount={columnKeys.length}
        selection={selection}
        onMouseDownSelect={onMouseDownSelect}
        onMouseEnterSelect={onMouseEnterSelect}
        onContextMenuSelect={onContextMenuSelect}
      />
    </tr>
  );
}

function VirtualFlatRow({
  item,
  rowIndex,
  sheetRowNumber: sheetNum,
  config,
  rules,
  customizeCell,
  columnWidths,
  defaultColWidth,
  rowHeight,
  onToggleRow,
  onSort,
  onCellDoubleClick,
  useRowDimColumns,
  rowDimCount,
  expandedRows,
  previousPathLabels = null,
  selection,
  columnKeys,
  dataColCount,
  onSelectCell,
  onMouseDownSelect,
  onMouseEnterSelect,
  onContextMenuSelect,
  rowDimLefts,
  banded = false
}: {
  item: LocalFlatPivotRowItem;
  rowIndex: number;
  /** Excel/WDR 1-based gutter including header-band offset. */
  sheetRowNumber: number;
  config: PivotConfig;
  rules: PivotConfig["options"]["conditionalFormats"];
  customizeCell?: CustomizeCellFn;
  columnWidths?: Record<string, number>;
  defaultColWidth?: number;
  rowHeight?: number;
  onToggleRow: (key: string) => void;
  onSort?: (fieldId: string) => void;
  onCellDoubleClick?: (cell: PivotCellType) => void;
  useRowDimColumns: boolean;
  rowDimCount: number;
  expandedRows: Set<string>;
  previousPathLabels?: string[] | null;
  selection: RangeSelection | null;
  columnKeys: string[];
  dataColCount: number;
  onSelectCell: (rowIndex: number, columnKey: string) => void;
  onMouseDownSelect: (rowIndex: number, columnKey: string, e: React.MouseEvent) => void;
  onMouseEnterSelect: (rowIndex: number, columnKey: string) => void;
  onContextMenuSelect: (
    rowIndex: number,
    columnKey: string,
    e: React.MouseEvent,
    cell?: PivotCellType | null,
    rowKey?: string
  ) => void;
  rowDimLefts: number[];
  banded?: boolean;
}) {
  const cellStyle = (columnKey: string) => {
    const w = columnWidths?.[columnKey] ?? defaultColWidth;
    return {
      width: w,
      minWidth: w,
      height: rowHeight,
      maxHeight: rowHeight
    };
  };

  const isColumnSelected = (columnKey: string) => {
    const colIndex = columnKeys.indexOf(columnKey);
    if (colIndex < 0) return false;
    return isCoordInSelection(selection, rowIndex, colIndex);
  };

  const getCellSelection = (columnKey: string) => {
    const colIndex = columnKeys.indexOf(columnKey);
    return getSelectionVisual(selection, rowIndex, colIndex);
  };

  const select = (columnKey: string) => onSelectCell(rowIndex, columnKey);
  const rowKeyForMenu = item.type === "row" ? item.rowKey : undefined;
  const cellPointer = {
    onMouseDownSelect: (columnKey: string, e: React.MouseEvent) =>
      onMouseDownSelect(rowIndex, columnKey, e),
    onMouseEnterSelect: (columnKey: string) => onMouseEnterSelect(rowIndex, columnKey),
    onContextMenuSelect: (columnKey: string, e: React.MouseEvent, cell?: PivotCellType | null) =>
      onContextMenuSelect(rowIndex, columnKey, e, cell, rowKeyForMenu)
  };

  if (item.type === "row") {
    return (
      <PivotRowView
        row={item.row}
        expanded={item.expanded}
        onToggle={() => onToggleRow(item.rowKey)}
        expandedRows={expandedRows}
        onTogglePath={onToggleRow}
        depth={item.depth}
        pathLabels={item.pathLabels}
        previousPathLabels={previousPathLabels}
        conditionalFormats={rules}
        customizeCell={customizeCell}
        config={config}
        rowKey={item.rowKey}
        cellStyle={cellStyle}
        onSortLabel={onSort ? () => config.rows[item.depth] && onSort(config.rows[item.depth]!) : undefined}
        onCellDoubleClick={onCellDoubleClick}
        isColumnSelected={isColumnSelected}
        getCellSelection={getCellSelection}
        onSelectCell={select}
        cellPointer={cellPointer}
        rowDimLefts={rowDimLefts}
        columnWidthsResolved={columnWidths}
        rowGutterNumber={sheetNum}
        emptySheetCols={EMPTY_SHEET_COLS}
        emptyColWidth={EMPTY_COL_WIDTH}
        banded={banded}
        rowIndex={rowIndex}
        dataColCount={dataColCount}
        selection={selection}
      />
    );
  }

  if (item.type === "subtotal" || item.type === "columnTotal" || item.type === "grandTotal") {
    const cells = item.type === "subtotal" ? item.subtotal.cells : item.total.cells;
    const hasSynthLabel = cells.some((c) => c.columnKey === "__row_label__");
    const labelCell = hasSynthLabel ? cells.find((c) => c.columnKey === "__row_label__") : null;
    const valueCells = hasSynthLabel
      ? cells.filter((c) => c.columnKey !== "__row_label__")
      : cells;
    const customizeContext =
      item.type === "subtotal"
        ? { isSubtotal: true as const }
        : item.type === "columnTotal"
          ? { isColumnTotal: true as const }
          : { isGrandTotal: true as const };

    const rowClass =
      item.type === "subtotal"
        ? styles.trSubtotal
        : item.type === "columnTotal"
          ? styles.trColumnTotal
          : styles.trGrandTotal;

    const labelVisual = useRowDimColumns
      ? getSpanSelectionVisual(selection, rowIndex, 0, rowDimCount - 1)
      : getCellSelection("__row_label__");

    return (
      <tr className={rowClass} style={{ height: rowHeight }}>
        <td className={styles.tdRowGutter} aria-hidden>
          {sheetNum}
        </td>
        {useRowDimColumns && rowDimCount > 0 ? (
          <>
            <td
              colSpan={rowDimCount}
              className={cn(
                styles.td,
                styles.tdRowDim,
                styles.tdLabel,
                selectionCellClassNames(labelVisual, { rowDim: true })
              )}
              style={{
                minWidth: Array.from({ length: rowDimCount }, (_, i) =>
                  columnWidths?.[`__row_dim_${i}__`] ?? defaultColWidth ?? 100
                ).reduce((a, b) => a + Number(b), 0),
                width: Array.from({ length: rowDimCount }, (_, i) =>
                  columnWidths?.[`__row_dim_${i}__`] ?? defaultColWidth ?? 100
                ).reduce((a, b) => a + Number(b), 0)
              }}
              onClick={() => select("__row_dim_0__")}
              onMouseDown={(e) => cellPointer.onMouseDownSelect?.("__row_dim_0__", e)}
              onMouseEnter={() => cellPointer.onMouseEnterSelect?.("__row_dim_0__")}
              onContextMenu={(e) => cellPointer.onContextMenuSelect?.("__row_dim_0__", e)}
            >
              {labelCell?.formatted || getPivotStrings().engine.grandTotal}
            </td>
            {valueCells.map((cell) => (
              <PivotCell
                key={cell.columnKey}
                cell={cell}
                conditionalFormats={rules}
                customizeCell={customizeCell}
                config={config}
                customizeContext={customizeContext}
                style={cellStyle(cell.columnKey)}
                selectionVisual={getCellSelection(cell.columnKey)}
                onSelect={() => select(cell.columnKey)}
                onMouseDownSelect={(e) => cellPointer.onMouseDownSelect?.(cell.columnKey, e)}
                onMouseEnterSelect={() => cellPointer.onMouseEnterSelect?.(cell.columnKey)}
                onContextMenuSelect={(e) => cellPointer.onContextMenuSelect?.(cell.columnKey, e, cell)}
                onDoubleClick={
                  onCellDoubleClick && item.type !== "subtotal"
                    ? () => onCellDoubleClick(cell)
                    : undefined
                }
              />
            ))}
          </>
        ) : (
          (hasSynthLabel ? cells : valueCells).map((cell) => (
            <PivotCell
              key={cell.columnKey}
              cell={cell}
              conditionalFormats={rules}
              customizeCell={customizeCell}
              config={config}
              customizeContext={customizeContext}
              style={cellStyle(cell.columnKey)}
              selectionVisual={getCellSelection(cell.columnKey)}
              variant={cell.columnKey === "__row_label__" ? "rowDim" : "value"}
              onSelect={() => select(cell.columnKey)}
              onMouseDownSelect={(e) => cellPointer.onMouseDownSelect?.(cell.columnKey, e)}
              onMouseEnterSelect={() => cellPointer.onMouseEnterSelect?.(cell.columnKey)}
              onContextMenuSelect={(e) => cellPointer.onContextMenuSelect?.(cell.columnKey, e, cell)}
              onDoubleClick={
                onCellDoubleClick && item.type !== "subtotal"
                  ? () => onCellDoubleClick(cell)
                  : undefined
              }
            />
          ))
        )}
        <SheetBufferBodyCell
          rowIndex={rowIndex}
          dataColCount={dataColCount}
          selection={selection}
          onMouseDownSelect={(key, e) => cellPointer.onMouseDownSelect?.(key, e)}
          onMouseEnterSelect={(key) => cellPointer.onMouseEnterSelect?.(key)}
          onContextMenuSelect={(key, e) => cellPointer.onContextMenuSelect?.(key, e)}
        />
      </tr>
    );
  }

  return null;
}
