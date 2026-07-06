"use client";

import type { ClientRow } from "@/lib/client-types";
import type { ClientRefDisplayMaps } from "@/lib/client-ref-display-maps";
import { pickCityTerritoryHint } from "@/lib/city-territory-hint";
import {
  displayAddress,
  displayAgentDay,
  displayAgentName,
  displayExpeditorPhone,
  displayLegalName,
  displayPinfl,
  displayVisitDateShort,
  getAllVisitWeekdaysForClient,
  getClientSlotsWithDataInRows,
  getExpeditorLabelsForClient,
  getVisitWeekdaysForSlot,
  parseGpsText
} from "@/lib/client-column-display";
import {
  CLIENT_COLUMN_TO_SORT,
  type ClientSortField
} from "@/lib/client-list-sort";
import {
  CLIENT_TABLE_COLUMNS,
  getDefaultColumnVisibility,
  type ClientColumnId
} from "@/lib/client-table-columns";
import { formatDigitsGroupedLoose, formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";
import { ClientsListPopup } from "@/components/clients/clients-list-popup";
import { TableRowActionGroup } from "@/components/data-table/table-row-actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, UserRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

type Props = {
  rows: ClientRow[];
  /** Eski rejim: visibility bo‘yicha; `orderedVisibleColumnIds` berilsa ustunlar tartibi server prefs dan */
  visibility: Record<string, boolean>;
  /** `useUserTablePrefs.visibleColumnOrder` — Amallar ustuni avtomatik qo‘shiladi */
  orderedVisibleColumnIds?: string[];
  /** Spravochnik kodlari o‘rniga nom chiqarish */
  refDisplayMaps?: ClientRefDisplayMaps;
  onEdit: (row: ClientRow) => void;
  /** Guruh amallari: birinchi ustunda tanlash */
  bulkSelect?: boolean;
  selectedIds?: ReadonlySet<number>;
  onToggleRow?: (id: number, selected: boolean) => void;
  /** Joriy sahifadagi barcha qatorlarni tanlash / bekor qilish */
  onTogglePage?: (selectAll: boolean) => void;
  /** Server tartiblash: ustun sarlavhasini bosish */
  sortField?: ClientSortField;
  sortOrder?: "asc" | "desc";
  onSortByColumn?: (columnId: ClientColumnId) => void;
};

function Txt(v: string | null | undefined): ReactNode {
  const t = v?.trim();
  if (!t) return null;
  return <span className="text-[13px] leading-snug text-gray-900">{t}</span>;
}

function TxtMono(v: string | null | undefined): ReactNode {
  const t = v?.trim();
  if (!t) return null;
  return <span className="font-mono text-[13px] leading-snug text-gray-900">{t}</span>;
}

function displayMapped(raw: string | null | undefined, map?: Record<string, string>): string | null {
  const t = raw?.trim();
  if (!t) return null;
  return map?.[t] ?? t;
}

function territoryHintForRow(maps: ClientRefDisplayMaps | undefined, city: string | null | undefined) {
  const hints = maps?.cityTerritoryHints;
  if (!hints) return null;
  return pickCityTerritoryHint(hints, city ?? "");
}

function agentSlotFromColumnId(colId: string): number | null {
  const a = /^agent_(\d+)$/.exec(colId);
  if (a) return Number(a[1]);
  const d = /^agent_(\d+)_day$/.exec(colId);
  if (d) return Number(d[1]);
  const e = /^expeditor_(\d+)$/.exec(colId);
  if (e) return Number(e[1]);
  return null;
}

const WD_SHORT = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/** Matn + «ещё N» bir qatorda; popup ochiq emas, faqat bosganda ochiladi */
function InlineOverflowCell({
  labels,
  popoverTitle
}: {
  labels: string[];
  popoverTitle: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  if (labels.length === 0) return null;
  const first = labels[0]!;
  const rest = labels.slice(1);

  return (
    <div
      ref={anchorRef}
      className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[13px] leading-snug text-gray-900"
    >
      <span className="min-w-0 truncate" title={first}>
        {first}
      </span>
      {rest.length > 0 ? (
        <ClientsListPopup
          items={labels}
          title={popoverTitle}
          anchorRef={anchorRef}
          trigger={
            <button
              type="button"
              className="shrink-0 cursor-pointer text-emerald-600 underline-offset-2 hover:underline"
            >
              ещё {rest.length}
            </button>
          }
        />
      ) : null}
    </div>
  );
}

function WeekdayTags({ days }: { days: number[] }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const labels = days.map((d) => WD_SHORT[d] ?? String(d));
  if (labels.length === 0) return null;
  const show = labels.slice(0, 3);
  const rest = labels.slice(3);

  return (
    <div
      ref={anchorRef}
      className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[13px] leading-snug text-gray-900"
    >
      <span className="min-w-0 truncate">{show.join(", ")}</span>
      {rest.length > 0 ? (
        <ClientsListPopup
          items={labels}
          title="Дни"
          anchorRef={anchorRef}
          trigger={
            <button
              type="button"
              className="shrink-0 cursor-pointer text-emerald-600 underline-offset-2 hover:underline"
            >
              ещё {rest.length}
            </button>
          }
        />
      ) : null}
    </div>
  );
}

function AgentAssignCell({ labels }: { labels: string[] }) {
  return <InlineOverflowCell labels={labels} popoverTitle="Все агенты" />;
}

function ExpeditorAssignCell({ labels }: { labels: string[] }) {
  return <InlineOverflowCell labels={labels} popoverTitle="Экспедиторы" />;
}

function cellContent(row: ClientRow, colId: ClientColumnId, maps?: ClientRefDisplayMaps): ReactNode {
  switch (colId) {
    case "name": {
      const t = row.name?.trim();
      return t ? <span className="text-[13px] font-semibold leading-snug text-gray-900">{t}</span> : null;
    }
    case "client_ref": {
      const ref = row.client_code?.trim();
      if (ref && ref.length > 0) {
        const grouped = /^\d+$/.test(ref.replace(/\s/g, ""))
          ? formatNumberGrouped(ref.replace(/\s/g, ""), { maxFractionDigits: 0 })
          : ref;
        return TxtMono(grouped);
      }
      return TxtMono(`#${formatGroupedInteger(row.id)}`);
    }
    case "legal_name":
      return Txt(displayLegalName(row));
    case "address":
      return Txt(displayAddress(row));
    case "phone": {
      const p = row.phone?.trim();
      if (!p) return null;
      return TxtMono(formatDigitsGroupedLoose(p));
    }
    case "agent_assignments_badge": {
      const sorted = [...(row.agent_assignments ?? [])].sort((a, b) => a.slot - b.slot);
      const labels: string[] = [];
      for (const a of sorted) {
        const name = a.agent_name?.trim();
        if (!name) continue;
        labels.push(name);
      }
      if (labels.length === 0) {
        const legacy = row.agent_name?.trim();
        if (legacy) labels.push(legacy);
      }
      return <AgentAssignCell labels={labels} />;
    }
    case "visit_weekdays_badge": {
      const wdays = getAllVisitWeekdaysForClient(row);
      if (wdays.length > 0) return <WeekdayTags days={wdays} />;
      const list = row.agent_assignments ?? [];
      if (list.length > 0) {
        for (const a of [...list].sort((x, y) => x.slot - y.slot)) {
          const date = displayVisitDateShort(a.visit_date);
          if (date) return Txt(date);
        }
      }
      const legacyDate = displayVisitDateShort(row.visit_date);
      return legacyDate ? Txt(legacyDate) : null;
    }
    case "expeditor_assignments_badge": {
      const labels = getExpeditorLabelsForClient(row);
      return <ExpeditorAssignCell labels={labels} />;
    }
    case "contact_person":
      return Txt(row.responsible_person);
    case "landmark":
      return Txt(row.landmark);
    case "inn": {
      const inn = row.inn?.trim();
      if (!inn) return null;
      return Txt(/^\d[\d\s-]*$/.test(inn) ? formatDigitsGroupedLoose(inn) : inn);
    }
    case "pinfl": {
      const pf = displayPinfl(row);
      if (!pf) return null;
      return Txt(formatDigitsGroupedLoose(pf));
    }
    case "trade_channel_code": {
      const sc = row.sales_channel?.trim();
      if (sc) return Txt(maps?.salesChannel?.[sc] ?? sc);
      return Txt(row.logistics_service);
    }
    case "client_category_code":
      return Txt(displayMapped(row.category, maps?.category));
    case "client_type_code":
      return Txt(displayMapped(row.client_type_code, maps?.clientType));
    case "format_code":
      return Txt(displayMapped(row.client_format, maps?.clientFormat));
    case "client_region": {
      const fromDb = displayMapped(row.region, maps?.region);
      if (fromDb) return Txt(fromDb);
      const h = territoryHintForRow(maps, row.city);
      return Txt(h?.region_label ?? h?.region_stored ?? null);
    }
    case "client_district": {
      const fromDb = displayMapped(row.district, maps?.district);
      if (fromDb) return Txt(fromDb);
      const h = territoryHintForRow(maps, row.city);
      return Txt(h?.district_label ?? h?.district_stored ?? null);
    }
    case "client_zone": {
      const fromDb = displayMapped(row.zone, maps?.zone);
      if (fromDb) return Txt(fromDb);
      const h = territoryHintForRow(maps, row.city);
      return Txt(h?.zone_label ?? h?.zone_stored ?? null);
    }
    case "city_code":
      return Txt(displayMapped(row.city, maps?.city));
    case "latitude": {
      const explicit =
        typeof row.latitude === "string" && row.latitude.trim() ? row.latitude.trim() : null;
      const parsed = parseGpsText(row.gps_text).lat;
      const v = explicit ?? parsed;
      if (!v?.trim()) return null;
      return Txt(formatNumberGrouped(v, { maxFractionDigits: 6 }));
    }
    case "longitude": {
      const explicit =
        typeof row.longitude === "string" && row.longitude.trim() ? row.longitude.trim() : null;
      const parsed = parseGpsText(row.gps_text).lng;
      const v = explicit ?? parsed;
      if (!v?.trim()) return null;
      return Txt(formatNumberGrouped(v, { maxFractionDigits: 6 }));
    }
    case "_actions":
      return null;
    default: {
      const m = /^agent_(\d+)$/.exec(colId);
      if (m) return Txt(displayAgentName(row, Number(m[1])));
      const d = /^agent_(\d+)_day$/.exec(colId);
      if (d) {
        const slot = Number(d[1]);
        const wdays = getVisitWeekdaysForSlot(row, slot);
        if (wdays.length > 0) return <WeekdayTags days={wdays} />;
        return Txt(displayAgentDay(row, slot));
      }
      const e = /^expeditor_(\d+)$/.exec(colId);
      if (e) {
        const ex = displayExpeditorPhone(row, Number(e[1]));
        if (!ex?.trim()) return null;
        return TxtMono(formatDigitsGroupedLoose(ex));
      }
      return null;
    }
  }
}

export function ClientsDataTable({
  rows,
  visibility,
  orderedVisibleColumnIds,
  refDisplayMaps,
  onEdit,
  bulkSelect = false,
  selectedIds,
  onToggleRow,
  onTogglePage,
  sortField,
  sortOrder,
  onSortByColumn
}: Props) {
  const headerCbRef = useRef<HTMLInputElement>(null);

  const slotsWithAgentData = useMemo(() => getClientSlotsWithDataInRows(rows), [rows]);

  const cols = useMemo(() => {
    const filterAgentTriplet = (
      list: (typeof CLIENT_TABLE_COLUMNS)[number][]
    ): (typeof CLIENT_TABLE_COLUMNS)[number][] =>
      list.filter((col) => {
        if (col.id === "_actions") return true;
        const slot = agentSlotFromColumnId(col.id);
        if (slot == null) return true;
        return slotsWithAgentData.has(slot);
      });

    if (orderedVisibleColumnIds?.length) {
      const dataCols = orderedVisibleColumnIds
        .map((id) => CLIENT_TABLE_COLUMNS.find((c) => c.id === id))
        .filter(
          (c): c is (typeof CLIENT_TABLE_COLUMNS)[number] => c != null && c.id !== "_actions"
        );
      const filtered = filterAgentTriplet(dataCols);
      const actions = CLIENT_TABLE_COLUMNS.find((c) => c.id === "_actions");
      return actions ? [...filtered, actions] : filtered;
    }
    let c = CLIENT_TABLE_COLUMNS.filter((x) => visibility[x.id] === true);
    if (c.length === 0) {
      const d = getDefaultColumnVisibility();
      c = CLIENT_TABLE_COLUMNS.filter((x) => d[x.id] === true);
    }
    return filterAgentTriplet(c);
  }, [orderedVisibleColumnIds, visibility, slotsWithAgentData]);

  const sel = selectedIds ?? new Set<number>();
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const someOnPage = rows.some((r) => sel.has(r.id));
  useEffect(() => {
    const el = headerCbRef.current;
    if (!el) return;
    el.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  const colCount = cols.length + (bulkSelect ? 1 : 0);
  /** Har bir `th` sticky — `overflow-x-auto` ichki wrapper sticky ni buzadi */
  const thCls =
    "sticky top-0 z-30 bg-muted px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-700 border-b border-border whitespace-nowrap shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1)]";

  return (
    <table className="w-full min-w-[2200px] border-collapse bg-card text-left text-sm">
        <thead>
          <tr>
            {bulkSelect ? (
              <th className={cn(thCls, "w-10 text-center")}>
                <input
                  ref={headerCbRef}
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-border text-emerald-600 focus:ring-emerald-500"
                  checked={allOnPage}
                  onChange={(e) => onTogglePage?.(e.target.checked)}
                  aria-label="Sahifani tanlash"
                />
              </th>
            ) : null}
            {cols.map((c) => {
              const sortKey = CLIENT_COLUMN_TO_SORT[c.id];
              const interactive = Boolean(sortKey && onSortByColumn);
              return (
                <th key={c.id} className={thCls}>
                  {interactive ? (
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase hover:bg-muted",
                        sortField === sortKey ? "text-gray-900" : "text-gray-600"
                      )}
                      onClick={() => onSortByColumn!(c.id)}
                      title="Tartiblash"
                    >
                      <span>{c.label}</span>
                      {sortField === sortKey ? (
                        sortOrder === "asc" ? (
                          <ArrowUp className="size-3 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                        ) : (
                          <ArrowDown className="size-3 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 shrink-0 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-gray-600">
                Нет данных. Попробуйте изменить фильтры
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  "group border-b border-border transition-colors hover:bg-emerald-50/30",
                  sel.has(row.id) && "bg-emerald-50/50",
                  idx % 2 === 1 && !sel.has(row.id) && "bg-muted/40"
                )}
              >
                {bulkSelect ? (
                  <td className="px-3 py-2.5 text-center align-middle">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-border text-emerald-600 focus:ring-emerald-500"
                      checked={sel.has(row.id)}
                      onChange={(e) => onToggleRow?.(row.id, e.target.checked)}
                      aria-label={`Клиент №${row.id}`}
                    />
                  </td>
                ) : null}
                {cols.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "border-b border-border px-3 py-2.5 align-middle text-gray-900",
                      c.id !== "_actions" && "min-w-0 max-w-[14rem]"
                    )}
                  >
                    {c.id === "_actions" ? (
                      <TableRowActionGroup>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="text-amber-400 opacity-0 transition-opacity hover:bg-amber-50 hover:text-amber-600 group-hover:opacity-100"
                          onClick={() => onEdit(row)}
                          title="Tahrirlash"
                          aria-label="Tahrirlash"
                        >
                          <Pencil className="size-3.5" aria-hidden />
                        </Button>
                        <Link
                          href={`/clients/${row.id}/balances`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon-sm" }),
                            "text-emerald-600 opacity-0 transition-opacity hover:bg-emerald-50 hover:text-emerald-700 group-hover:opacity-100"
                          )}
                          title="Kartochka"
                          aria-label="Kartochka"
                        >
                          <UserRound className="size-3.5" aria-hidden />
                        </Link>
                      </TableRowActionGroup>
                    ) : (
                      cellContent(row, c.id, refDisplayMaps)
                    )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
    </table>
  );
}
