"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import type { WorkSlotListItem } from "@/lib/work-slots-types";
import {
  WORK_SLOTS_COLUMN_LABEL_BY_ID,
  formatSlotDate,
  slotTypeLabel,
  type WorkSlotsColumnId
} from "./work-slots-utils";
import { SlotBadge } from "./slot-badge";

type Props = {
  rows: WorkSlotListItem[];
  visibleColumnOrder: readonly string[];
  resolveTerritoryLabel?: (raw: string) => string;
  selectedIds: Set<number>;
  onToggleRow: (id: number, checked: boolean) => void;
  onTogglePage: (checked: boolean) => void;
  onEdit: (id: number) => void;
  onAssign: (id: number) => void;
  embedded?: boolean;
};

function cellTerritory(raw: string | null | undefined, resolve?: (s: string) => string) {
  const t = raw?.trim();
  if (!t) return "—";
  return resolve ? resolve(t) : t;
}

function renderCell(
  slot: WorkSlotListItem,
  colId: string,
  resolveTerritoryLabel: Props["resolveTerritoryLabel"],
  router: ReturnType<typeof useRouter>
) {
  const id = colId as WorkSlotsColumnId;
  switch (id) {
    case "code":
      return (
        <button
          type="button"
          className="text-left hover:opacity-80"
          title="Подробнее"
          onClick={() => router.push(`/work-slots/${slot.id}`)}
        >
          <SlotBadge code={slot.slot_code} />
        </button>
      );
    case "label":
      return <span className="block max-w-[10rem] truncate">{slot.label ?? "—"}</span>;
    case "employee":
      return slot.active_user_name ? (
        <div>
          <div>{slot.active_user_name}</div>
          {slot.active_since ? (
            <div className="text-[10px] text-muted-foreground">{formatSlotDate(slot.active_since)}</div>
          ) : null}
        </div>
      ) : (
        <span className="italic text-muted-foreground">Пусто</span>
      );
    case "territory_zone":
      return cellTerritory(slot.active_territory_zone, resolveTerritoryLabel);
    case "territory_oblast":
      return cellTerritory(slot.active_territory_oblast, resolveTerritoryLabel);
    case "territory_city":
      return cellTerritory(slot.active_territory_city, resolveTerritoryLabel);
    case "warehouse":
      return <span className="block max-w-[8rem] truncate">{slot.active_warehouse_name ?? "—"}</span>;
    case "cash_desk":
      return <span className="block max-w-[8rem] truncate">{slot.active_cash_desk_names ?? "—"}</span>;
    case "branch":
      return slot.branch_code ?? "—";
    case "role":
      return slotTypeLabel(slot.slot_type);
    default:
      return "—";
  }
}

export function WorkSlotsListTable({
  rows,
  visibleColumnOrder,
  resolveTerritoryLabel,
  selectedIds,
  onToggleRow,
  onTogglePage,
  onEdit,
  onAssign,
  embedded = false
}: Props) {
  const router = useRouter();
  const headerCbRef = useRef<HTMLInputElement>(null);
  const colCount = visibleColumnOrder.length + 2;

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = rows.some((r) => selectedIds.has(r.id));

  useEffect(() => {
    const el = headerCbRef.current;
    if (!el) return;
    el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-xs">
        <thead className="app-table-thead">
          <tr>
            <th className="w-10 whitespace-nowrap px-2 py-2 text-left">
              <input
                ref={headerCbRef}
                type="checkbox"
                className="size-4 rounded border-input accent-primary"
                checked={allOnPageSelected}
                onChange={(e) => onTogglePage(e.target.checked)}
                aria-label="Выбрать все на странице"
              />
            </th>
            {visibleColumnOrder.map((colId) => (
              <th key={colId} className="whitespace-nowrap px-2 py-2 text-left">
                {WORK_SLOTS_COLUMN_LABEL_BY_ID.get(colId) ?? colId}
              </th>
            ))}
            <th className="w-[9rem] min-w-[9rem] whitespace-nowrap px-2 py-2 text-right">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-3 py-10 text-center text-muted-foreground">
                Нет данных
              </td>
            </tr>
          ) : (
            rows.map((slot) => (
              <tr
                key={slot.id}
                className={`border-t border-border/60 transition-colors even:bg-muted/20 hover:bg-muted/30 ${!slot.is_active ? "opacity-55" : ""} ${selectedIds.has(slot.id) ? "bg-primary/5" : ""}`}
              >
                <td className="px-2 py-2">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-input accent-primary"
                    checked={selectedIds.has(slot.id)}
                    onChange={(e) => onToggleRow(slot.id, e.target.checked)}
                    aria-label={`Выбрать ${slot.slot_code}`}
                  />
                </td>
                {visibleColumnOrder.map((colId) => (
                  <td key={colId} className="max-w-[10rem] truncate px-2 py-2">
                    {renderCell(slot, colId, resolveTerritoryLabel, router)}
                  </td>
                ))}
                <td className="w-[9rem] min-w-[9rem] px-2 py-2 text-right">
                  <TableRowActionGroup className="justify-end" ariaLabel="Действия">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      title="Подробнее"
                      aria-label="Подробнее"
                      onClick={() => router.push(`/work-slots/${slot.id}`)}
                    >
                      <Eye className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      title="Редактировать"
                      aria-label="Редактировать"
                      onClick={() => onEdit(slot.id)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      title="Сменить сотрудника"
                      aria-label="Сменить сотрудника"
                      onClick={() => onAssign(slot.id)}
                    >
                      <UserRound className="size-3.5" aria-hidden />
                    </Button>
                  </TableRowActionGroup>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (embedded) return table;

  return (
    <div className="orders-hub-section orders-hub-section--table mt-4">
      <Card className="overflow-hidden rounded-none border-0 bg-transparent shadow-none hover:shadow-none">
        <CardContent className="p-0">{table}</CardContent>
      </Card>
    </div>
  );
}
