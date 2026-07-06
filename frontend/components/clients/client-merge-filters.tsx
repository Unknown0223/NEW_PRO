"use client";

import { FilterSearchableSelect } from "@/components/ui/filter-searchable-select";
import { FilterSelect } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useState } from "react";

export const MERGE_SEARCH_FIELD_OPTS = [
  { id: "name", label: "Название" },
  { id: "legal_name", label: "Название компании" },
  { id: "phone", label: "Номер телефона" },
  { id: "inn", label: "ИНН" },
  { id: "pinfl", label: "Пинфл" },
  { id: "contract", label: "Номер договора" },
  { id: "address", label: "Адрес" }
] as const;

export type AppliedDupFilters = {
  agent_id: string;
  region: string;
  zone: string;
  city: string;
  client_format: string;
  category: string;
  client_type_codes: string[];
  is_active: "all" | "yes" | "no";
  search: string;
  search_fields: string[];
  geo_radius_m: string;
};

export function defaultAppliedDupFilters(): AppliedDupFilters {
  return {
    agent_id: "",
    region: "",
    zone: "",
    city: "",
    client_format: "",
    category: "",
    client_type_codes: [],
    is_active: "all",
    search: "",
    search_fields: ["name", "legal_name"],
    geo_radius_m: "20"
  };
}

export function buildDupQueryString(
  tab: "fields" | "geo",
  page: number,
  limit: number,
  applied: AppliedDupFilters
): string {
  const p = new URLSearchParams();
  p.set("tab", tab);
  p.set("page", String(page));
  p.set("limit", String(limit));
  if (applied.search.trim()) p.set("search", applied.search.trim());
  if (applied.search_fields.length > 0) p.set("search_fields", applied.search_fields.join(","));
  if (applied.agent_id) p.set("agent_id", applied.agent_id);
  if (applied.region) p.set("region", applied.region);
  if (applied.zone) p.set("zone", applied.zone);
  if (applied.city) p.set("city", applied.city);
  if (applied.client_format) p.set("client_format", applied.client_format);
  if (applied.category) p.set("category", applied.category);
  if (applied.client_type_codes.length > 0) p.set("client_type_codes", applied.client_type_codes.join(","));
  if (applied.is_active !== "all") p.set("is_active", applied.is_active);
  if (tab === "geo") {
    const r = Number.parseInt(applied.geo_radius_m, 10);
    if (Number.isFinite(r) && r > 0) p.set("geo_radius_m", String(r));
  }
  return p.toString();
}

const SELECT_INNER =
  "h-auto min-h-0 border-0 bg-transparent p-0 text-[13px] font-medium text-slate-800 shadow-none hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0";

type FilterPopoverKind = null | "clientTypes" | "searchFields";

type ClientRefs = {
  client_formats?: string[];
  categories?: string[];
  category_options?: { value: string; label: string }[];
};

function MergeFilterBox({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-12 min-w-[150px] flex-1 flex-col justify-center rounded-lg border border-border bg-card px-3",
        className
      )}
    >
      <div className="text-[11px] leading-none text-slate-500">{label}</div>
      <div className={cn("mt-0.5 min-w-0 [&_button]:text-left", SELECT_INNER)}>{children}</div>
    </div>
  );
}

function MergePopoverField({
  label,
  value,
  onClear,
  onClick,
  open
}: {
  label: string;
  value: string;
  onClear?: () => void;
  onClick: () => void;
  open?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-12 min-w-[220px] flex-1 items-center rounded-lg border border-border bg-card px-3 text-left transition hover:border-border",
        open && "ring-2 ring-emerald-500/30"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] leading-none text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-[13px] font-medium text-slate-800">{value}</div>
      </div>
      {onClear ? (
        <span
          role="button"
          tabIndex={0}
          className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-muted hover:text-slate-600"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              onClear();
            }
          }}
        >
          <X className="h-3.5 w-3.5" />
        </span>
      ) : null}
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  );
}

export function ClientMergeFilterBar(props: {
  draft: AppliedDupFilters;
  setDraft: Dispatch<SetStateAction<AppliedDupFilters>>;
  agentOptions: { value: string; label: string }[];
  regionOptions: { value: string; label: string }[];
  zoneOptions: { value: string; label: string }[];
  cityOptions: { value: string; label: string }[];
  clientTypeOptions: { value: string; label: string }[];
  refs: ClientRefs | undefined;
  showGeoRadius?: boolean;
  searchFieldsSummary: string;
  toggleSearchField: (id: string, checked: boolean) => void;
  selectAllSearchFields: () => void;
  toggleClientType: (code: string, checked: boolean) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const {
    draft,
    setDraft,
    agentOptions,
    regionOptions,
    zoneOptions,
    cityOptions,
    clientTypeOptions,
    refs,
    showGeoRadius,
    searchFieldsSummary,
    toggleSearchField,
    selectAllSearchFields,
    toggleClientType,
    onApply,
    onReset
  } = props;

  const [filterPopover, setFilterPopover] = useState<FilterPopoverKind>(null);
  const [selectCloseToken, setSelectCloseToken] = useState(0);
  const bumpSelectClose = () => setSelectCloseToken((t) => t + 1);

  const closeAll = () => {
    bumpSelectClose();
    setFilterPopover(null);
  };

  const handleApply = () => {
    closeAll();
    onApply();
  };

  const handleReset = () => {
    closeAll();
    onReset();
  };

  useEffect(() => {
    if (!filterPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterPopover(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterPopover]);

  const fmtOpts = (refs?.client_formats ?? []).map((x) => ({ value: x, label: x }));
  const catOpts =
    (refs?.category_options ?? []).length > 0
      ? (refs!.category_options ?? []).map((x) => ({ value: x.value, label: x.label }))
      : (refs?.categories ?? []).map((x) => ({ value: x, label: x }));

  const selectCloseProps = {
    closeToken: selectCloseToken,
    onOpenChange: (o: boolean) => {
      if (o) setFilterPopover(null);
    }
  } as const;

  const statusLabel =
    draft.is_active === "yes" ? "Активный" : draft.is_active === "no" ? "Не активный" : "Все";

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-wrap items-center gap-3">
        <MergeFilterBox label="Агент">
          <FilterSearchableSelect
            emptyLabel="Все агенты"
            value={draft.agent_id}
            onValueChange={(v) => setDraft((d) => ({ ...d, agent_id: v }))}
            options={agentOptions}
            className={SELECT_INNER}
            focusRing={false}
            {...selectCloseProps}
          />
        </MergeFilterBox>

        <MergeFilterBox label="Область">
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.region}
            onValueChange={(v) => setDraft((d) => ({ ...d, region: v, zone: "", city: "" }))}
            options={regionOptions}
            className={SELECT_INNER}
            focusRing={false}
            {...selectCloseProps}
          />
        </MergeFilterBox>

        <MergeFilterBox label="Зона">
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.zone}
            onValueChange={(v) => setDraft((d) => ({ ...d, zone: v, city: "" }))}
            options={zoneOptions}
            disabled={zoneOptions.length === 0}
            className={SELECT_INNER}
            focusRing={false}
            {...selectCloseProps}
          />
        </MergeFilterBox>

        <MergeFilterBox label="Город">
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.city}
            onValueChange={(v) => setDraft((d) => ({ ...d, city: v }))}
            options={cityOptions}
            className={SELECT_INNER}
            focusRing={false}
            {...selectCloseProps}
          />
        </MergeFilterBox>

        <MergeFilterBox label="Формат клиента">
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.client_format}
            onValueChange={(v) => setDraft((d) => ({ ...d, client_format: v }))}
            options={fmtOpts}
            className={SELECT_INNER}
            focusRing={false}
            {...selectCloseProps}
          />
        </MergeFilterBox>

        <MergeFilterBox label="Категория клиента">
          <FilterSearchableSelect
            emptyLabel="Все"
            value={draft.category}
            onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            options={catOpts}
            className={SELECT_INNER}
            focusRing={false}
            {...selectCloseProps}
          />
        </MergeFilterBox>

        <div className="relative min-w-[150px] flex-1">
          <MergeFilterBox label="Тип клиента">
            <button
              type="button"
              className="flex w-full items-center justify-between text-[13px] font-medium text-slate-800"
              onClick={() => {
                bumpSelectClose();
                setFilterPopover((p) => (p === "clientTypes" ? null : "clientTypes"));
              }}
            >
              <span className="truncate">
                {draft.client_type_codes.length === 0
                  ? "Все типы"
                  : `${draft.client_type_codes.length} выбрано`}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </MergeFilterBox>
          {filterPopover === "clientTypes" ? (
            <div
              data-merge-popover-root
              className="absolute left-0 top-full z-[480] mt-1 max-h-56 w-full min-w-[220px] overflow-auto rounded-lg border border-border bg-card p-2 shadow-lg"
            >
              {clientTypeOptions.length === 0 ? (
                <p className="p-2 text-xs text-slate-500">Нет справочника типов</p>
              ) : (
                clientTypeOptions.map((o) => (
                  <label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={draft.client_type_codes.includes(o.value)}
                      onChange={(e) => toggleClientType(o.value, e.target.checked)}
                    />
                    <span className="truncate">{o.label}</span>
                  </label>
                ))
              )}
            </div>
          ) : null}
        </div>

        <MergeFilterBox label="Статус" className="min-w-[120px] max-w-[160px]">
          <FilterSelect
            emptyLabel="Все"
            className={cn(SELECT_INNER, "w-full")}
            value={draft.is_active === "all" ? "" : draft.is_active}
            onMouseDown={() => {
              bumpSelectClose();
              setFilterPopover(null);
            }}
            onChange={(e) => {
              const v = e.target.value;
              setDraft((d) => ({
                ...d,
                is_active: v === "" ? "all" : v === "yes" ? "yes" : "no"
              }));
            }}
          >
            <option value="yes">Активный</option>
            <option value="no">Не активный</option>
          </FilterSelect>
          {!draft.is_active || draft.is_active === "all" ? null : (
            <span className="sr-only">{statusLabel}</span>
          )}
        </MergeFilterBox>

        {showGeoRadius ? (
          <div className="flex h-12 min-w-[120px] flex-col justify-center rounded-lg border border-border bg-card px-3">
            <div className="text-[11px] leading-none text-slate-500">Радиус (м)</div>
            <input
              type="number"
              min={1}
              max={5000}
              value={draft.geo_radius_m}
              onChange={(e) => setDraft((d) => ({ ...d, geo_radius_m: e.target.value }))}
              className="mt-0.5 w-full bg-transparent text-[13px] font-medium text-slate-800 outline-none"
            />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <MergePopoverField
            label="Поиск по"
            value={searchFieldsSummary}
            onClick={() => {
              bumpSelectClose();
              setFilterPopover((p) => (p === "searchFields" ? null : "searchFields"));
            }}
            open={filterPopover === "searchFields"}
          />
          {filterPopover === "searchFields" ? (
            <div
              data-merge-popover-root
              className="absolute left-0 top-full z-[480] mt-1 w-full min-w-[280px] max-w-md rounded-lg border border-border bg-card p-2 shadow-lg"
            >
              <button
                type="button"
                className="mb-2 text-xs font-medium text-emerald-700 hover:underline"
                onClick={() => selectAllSearchFields()}
              >
                Выбрать все
              </button>
              <div className="grid gap-1 sm:grid-cols-2">
                {MERGE_SEARCH_FIELD_OPTS.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={draft.search_fields.includes(o.id)}
                      onChange={(e) => toggleSearchField(o.id, e.target.checked)}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex h-12 min-w-[200px] flex-[2] flex-col justify-center rounded-lg border border-border bg-card px-3">
          <div className="text-[11px] leading-none text-slate-500">Строка поиска</div>
          <input
            placeholder="Название, ИНН, телефон…"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleApply();
            }}
            className="mt-0.5 w-full bg-transparent text-[13px] font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            title="Сбросить фильтры"
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-slate-600 transition hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="h-11 rounded-lg bg-slate-800 px-8 text-[14px] font-medium text-white shadow-sm transition hover:bg-slate-900"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
