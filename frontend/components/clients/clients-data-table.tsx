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
  getClientSlotsWithDataInRows,
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

/** Bo‘sh qiymat — faqat chiziq (—) */
function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function Txt(v: string | null | undefined): ReactNode {
  const t = v?.trim();
  if (!t) return <Dash />;
  return <span className="text-xs">{t}</span>;
}

function TxtMono(v: string | null | undefined): ReactNode {
  const t = v?.trim();
  if (!t) return <Dash />;
  return <span className="font-mono text-xs">{t}</span>;
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

function WeekdayTags({ days }: { days: number[] }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const labels = days.map((d) => WD_SHORT[d] ?? String(d));
  const show = labels.slice(0, 2);
  const rest = labels.slice(2);

  return (
    <div ref={anchorRef} className="flex items-center gap-1 whitespace-nowrap">
      {show.map((day, i) => (
        <span
          key={`${day}-${i}`}
          className="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600"
        >
          {day}
        </span>
      ))}
      {rest.length > 0 ? (
        <ClientsListPopup
          items={labels}
          title="Дни"
          anchorRef={anchorRef}
          trigger={
            <span className="cursor-pointer rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-100">
              ещё {rest.length}
            </span>
          }
        />
      ) : null}
    </div>
  );
}

function AgentAssignCell({ labels }: { labels: string[] }) {
  const anchorRef = useRef<HTMLDivElement>(null);
  if (labels.length === 0) return <Dash />;
  const first = labels[0]!;
  const rest = labels.slice(1);

  return (
    <div ref={anchorRef} className="flex min-w-[220px] items-center gap-1">
      <span className="block min-w-0 flex-1 truncate rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[11px] leading-tight text-emerald-700">
        {first}
      </span>
      {rest.length > 0 ? (
        <ClientsListPopup
          items={labels}
          title="ВСЕ АГЕНТЫ"
          anchorRef={anchorRef}
          trigger={
            <span className="shrink-0 cursor-pointer whitespace-nowrap rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-100">
              ещё {rest.length}
            </span>
          }
        />
      ) : null}
    </div>
  );
}

function FormatBadge({ value }: { value: string }) {
  return (
    <span className="rounded-md border border-gray-200 bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600">
      {value}
    </span>
  );
}

function cellContent(row: ClientRow, colId: ClientColumnId, maps?: ClientRefDisplayMaps): ReactNode {
  const dash = <Dash />;

  switch (colId) {
    case "name": {
      const t = row.name?.trim();
      return t ? <span className="font-medium">{t}</span> : dash;
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
      if (!p) return dash;
      const g = formatDigitsGroupedLoose(p);
      return TxtMono(g);
    }
    case "agent_assignments_badge": {
      const sorted = [...row.agent_assignments].sort((a, b) => a.slot - b.slot);
      const labels: string[] = [];
      const wdRu = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
      for (const a of sorted) {
        const name = a.agent_name?.trim();
        const code = a.agent_code?.trim();
        if (!name && !code) continue;
        const label = [code, name].filter(Boolean).join(" ");
        const date = displayVisitDateShort(a.visit_date);
        const wdays = getVisitWeekdaysForSlot(row, a.slot);
        const wdPart =
          wdays.length > 0
            ? ` · ${wdays.map((d) => wdRu[d] ?? String(d)).join(" ")}`
            : "";
        const datePart = wdays.length === 0 && date ? ` · ${date}` : "";
        labels.push(`${label}${wdPart}${datePart}`);
      }
      if (labels.length === 0) {
        const legacy = row.agent_name?.trim();
        if (legacy) {
          const d = displayVisitDateShort(row.visit_date);
          const wdays = getVisitWeekdaysForSlot(row, 1);
          const wdPart =
            wdays.length > 0 ? ` · ${wdays.map((k) => wdRu[k] ?? String(k)).join(" ")}` : "";
          const datePart = d && wdays.length === 0 ? ` · ${d}` : "";
          labels.push(`${legacy}${wdPart}${datePart}`);
        }
      }
      return <AgentAssignCell labels={labels} />;
    }
    case "contact_person":
      return Txt(row.responsible_person);
    case "landmark":
      return Txt(row.landmark);
    case "inn": {
      const inn = row.inn?.trim();
      if (!inn) return dash;
      return Txt(/^\d[\d\s-]*$/.test(inn) ? formatDigitsGroupedLoose(inn) : inn);
    }
    case "pinfl": {
      const pf = displayPinfl(row);
      if (!pf) return dash;
      return Txt(formatDigitsGroupedLoose(pf));
    }
    case "trade_channel_code": {
      const sc = row.sales_channel?.trim();
      if (sc) return Txt(maps?.salesChannel?.[sc] ?? sc);
      return Txt(row.logistics_service);
    }
    case "client_category_code": {
      const t = displayMapped(row.category, maps?.category);
      if (!t) return dash;
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-[10px] font-bold text-gray-500">
          {t}
        </span>
      );
    }
    case "client_type_code":
      return Txt(displayMapped(row.client_type_code, maps?.clientType));
    case "format_code": {
      const t = displayMapped(row.client_format, maps?.clientFormat);
      if (!t) return dash;
      return <FormatBadge value={t} />;
    }
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
      if (!v?.trim()) return dash;
      return Txt(formatNumberGrouped(v, { maxFractionDigits: 6 }));
    }
    case "longitude": {
      const explicit =
        typeof row.longitude === "string" && row.longitude.trim() ? row.longitude.trim() : null;
      const parsed = parseGpsText(row.gps_text).lng;
      const v = explicit ?? parsed;
      if (!v?.trim()) return dash;
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
        if (!ex?.trim()) return dash;
        return TxtMono(formatDigitsGroupedLoose(ex));
      }
      return dash;
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
  const thCls =
    "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50 border-b border-gray-200 whitespace-nowrap";

  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[2200px] border-collapse text-left text-sm">
        <thead>
          <tr>
            {bulkSelect ? (
              <th className={cn(thCls, "w-10 text-center")}>
                <input
                  ref={headerCbRef}
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
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
                        "inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold uppercase hover:bg-gray-100",
                        sortField === sortKey ? "text-gray-700" : "text-gray-400"
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
              <td colSpan={colCount} className="px-3 py-10 text-center text-sm text-gray-500">
                Нет данных. Попробуйте изменить фильтры
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id}
                className={cn(
                  "group border-b border-gray-100 transition-colors hover:bg-emerald-50/30",
                  sel.has(row.id) && "bg-emerald-50/50",
                  idx % 2 === 1 && !sel.has(row.id) && "bg-gray-50/40"
                )}
              >
                {bulkSelect ? (
                  <td className="px-3 py-3 text-center align-top">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
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
                      "px-3 py-3 align-top text-xs text-gray-600",
                      c.id !== "_actions" && "min-w-0 max-w-[13rem] break-words [word-break:break-word]"
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
    </div>
  );
}
