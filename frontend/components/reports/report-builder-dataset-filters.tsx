"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Filter } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePopover, formatDateRangeButton } from "@/components/ui/date-range-popover";
import { SearchableMultiSelectPanel } from "@/components/ui/searchable-multi-select-panel";
import { cn } from "@/lib/utils";
import {
  defaultDatasetFilters,
  type DatasetFiltersPayload,
  type ReportBuilderDateMode
} from "@/lib/report-builder-wdr-migrate";
import { territoryFallbackFromProfile, type TerritoryFallback } from "@/lib/report-builder-territory";

export type ReportBuilderFilterOptions = {
  agents: Array<{
    id: number;
    name: string;
    code: string | null;
    supervisor_user_id: number | null;
    trade_direction_id: number | null;
    branch: string | null;
  }>;
  statuses: Array<{ id: string; label: string }>;
  order_types: Array<{ id: string; label: string }>;
  warehouses: Array<{ id: number; name: string; code: string | null }>;
  products: Array<{
    id: number;
    name: string;
    sku: string;
    category_id: number | null;
    product_group_id: number | null;
    brand_id: number | null;
  }>;
  product_categories: Array<{ id: number; name: string }>;
  product_groups: Array<{ id: number; name: string; code: string | null }>;
  brands: Array<{ id: number; name: string; code: string | null }>;
  expeditors: Array<{ id: number; name: string; code: string | null }>;
  supervisors: Array<{ id: number; name: string; code: string | null }>;
  trade_directions: Array<{ id: number; name: string; code: string | null }>;
  kpi_groups: Array<{ id: number; name: string; code: string | null }>;
  clients: Array<{ id: number; name: string; code: string | null }>;
  payment_methods: Array<{ id: string; label: string }>;
  price_types: Array<{ id: string; label: string }>;
  branches: Array<{ id: string; label: string }>;
  client_categories: Array<{ id: string; label: string }>;
  territory_level_1: Array<{ id: string; label: string }>;
  territory_level_2: Array<{ id: string; label: string }>;
  territory_level_3: Array<{ id: string; label: string }>;
  territory_2_by_1: Record<string, string[]>;
  territory_3_by_2: Record<string, string[]>;
};

type Props = {
  filters: DatasetFiltersPayload;
  onFiltersChange: (next: DatasetFiltersPayload | ((prev: DatasetFiltersPayload) => DatasetFiltersPayload)) => void;
  filterOptions?: ReportBuilderFilterOptions;
  dateModes?: Array<{ id: ReportBuilderDateMode; label: string }>;
  profileData?: Record<string, unknown>;
  title?: string;
  actions?: React.ReactNode;
  collapsible?: boolean;
};

function numSelected(set: Set<string>): number[] {
  return Array.from(set)
    .map((x) => Number.parseInt(String(x), 10))
    .filter((n) => n > 0);
}

export function ReportBuilderDatasetFiltersPanel({
  filters,
  onFiltersChange,
  filterOptions,
  dateModes,
  profileData,
  title = "Фильтры",
  actions,
  collapsible = true
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const dateAnchorRef = useRef<HTMLButtonElement>(null);

  const territoryFallback: TerritoryFallback = useMemo(
    () => territoryFallbackFromProfile(profileData),
    [profileData]
  );

  const dateModeItems = useMemo(
    () =>
      (dateModes ?? [
        { id: "order_date" as const, label: "Дата заказа" },
        { id: "shipped_date" as const, label: "Дата отправки" },
        { id: "created_date" as const, label: "Дата создания" }
      ]).filter((dm) => dm.id !== "delivered_date"),
    [dateModes]
  );

  const agentItems = useMemo(() => {
    const selectedSupervisors = new Set(filters.supervisorUserIds);
    const selectedTradeDirections = new Set(filters.tradeDirectionIds);
    const selectedBranches = new Set(filters.branchValues);
    return (filterOptions?.agents ?? [])
      .filter((a) => {
        if (
          selectedSupervisors.size > 0 &&
          (a.supervisor_user_id == null || !selectedSupervisors.has(a.supervisor_user_id))
        ) {
          return false;
        }
        if (
          selectedTradeDirections.size > 0 &&
          (a.trade_direction_id == null || !selectedTradeDirections.has(a.trade_direction_id))
        ) {
          return false;
        }
        if (selectedBranches.size > 0 && (!a.branch || !selectedBranches.has(a.branch))) {
          return false;
        }
        return true;
      })
      .map((a) => ({ id: String(a.id), title: a.code ? `${a.code} — ${a.name}` : a.name }));
  }, [
    filterOptions?.agents,
    filters.supervisorUserIds,
    filters.tradeDirectionIds,
    filters.branchValues
  ]);

  const productItems = useMemo(() => {
    const selectedCategories = new Set(filters.categoryIds);
    const selectedGroups = new Set(filters.productGroupIds);
    const selectedBrands = new Set(filters.brandIds);
    return (filterOptions?.products ?? [])
      .filter((p) => {
        if (selectedCategories.size > 0 && (p.category_id == null || !selectedCategories.has(p.category_id))) {
          return false;
        }
        if (selectedGroups.size > 0 && (p.product_group_id == null || !selectedGroups.has(p.product_group_id))) {
          return false;
        }
        if (selectedBrands.size > 0 && (p.brand_id == null || !selectedBrands.has(p.brand_id))) {
          return false;
        }
        return true;
      })
      .map((p) => ({ id: String(p.id), title: `${p.sku} — ${p.name}` }));
  }, [filterOptions?.products, filters.categoryIds, filters.productGroupIds, filters.brandIds]);

  const territory1Items = useMemo(() => {
    const base = filterOptions?.territory_level_1 ?? [];
    const list = base.length > 0 ? base.map((t) => t.id) : territoryFallback.territory1;
    return list.map((id) => ({ id, title: id }));
  }, [filterOptions?.territory_level_1, territoryFallback.territory1]);

  const territory2Items = useMemo(() => {
    const base = filterOptions?.territory_level_2 ?? [];
    const all = base.length > 0 ? base : territoryFallback.territory2.map((id) => ({ id, label: id }));
    const map = (filterOptions?.territory_2_by_1 ?? territoryFallback.territory2By1) as Record<string, string[]>;
    if (filters.territoryLevel1Values.length === 0) return all.map((t) => ({ id: t.id, title: t.label }));
    const allowed = new Set<string>();
    for (const zone of filters.territoryLevel1Values) {
      for (const oblast of map[zone] ?? []) allowed.add(oblast);
    }
    const scoped = all.filter((t) => allowed.has(t.id));
    return (scoped.length > 0 ? scoped : all).map((t) => ({ id: t.id, title: t.label }));
  }, [
    filterOptions?.territory_level_2,
    filterOptions?.territory_2_by_1,
    territoryFallback.territory2,
    territoryFallback.territory2By1,
    filters.territoryLevel1Values
  ]);

  const territory3Items = useMemo(() => {
    const base = filterOptions?.territory_level_3 ?? [];
    const all = base.length > 0 ? base : territoryFallback.territory3.map((id) => ({ id, label: id }));
    const map = (filterOptions?.territory_3_by_2 ?? territoryFallback.territory3By2) as Record<string, string[]>;
    if (filters.territoryLevel2Values.length === 0) return all.map((t) => ({ id: t.id, title: t.label }));
    const allowed = new Set<string>();
    for (const oblast of filters.territoryLevel2Values) {
      for (const city of map[oblast] ?? []) allowed.add(city);
    }
    const scoped = all.filter((t) => allowed.has(t.id));
    return (scoped.length > 0 ? scoped : all).map((t) => ({ id: t.id, title: t.label }));
  }, [
    filterOptions?.territory_level_3,
    filterOptions?.territory_3_by_2,
    territoryFallback.territory3,
    territoryFallback.territory3By2,
    filters.territoryLevel2Values
  ]);

  useEffect(() => {
    const allowed = new Set(agentItems.map((x) => Number.parseInt(String(x.id), 10)).filter((n) => n > 0));
    if (allowed.size === 0) return;
    onFiltersChange((prev) => {
      const nextAgentIds = prev.agentIds.filter((id) => allowed.has(id));
      return nextAgentIds.length === prev.agentIds.length ? prev : { ...prev, agentIds: nextAgentIds };
    });
  }, [agentItems, onFiltersChange]);

  useEffect(() => {
    const allowed = new Set(productItems.map((x) => Number.parseInt(String(x.id), 10)).filter((n) => n > 0));
    if (allowed.size === 0) return;
    onFiltersChange((prev) => {
      const nextProductIds = prev.productIds.filter((id) => allowed.has(id));
      return nextProductIds.length === prev.productIds.length ? prev : { ...prev, productIds: nextProductIds };
    });
  }, [productItems, onFiltersChange]);

  const periodBtn = formatDateRangeButton(filters.dateFrom, filters.dateTo);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        {collapsible ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? "Развернуть фильтры" : "Свернуть фильтры"}
          </Button>
        ) : null}
      </CardHeader>
      {!collapsed ? (
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Дата применяется по
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {dateModeItems.map((dm) => (
                  <label key={dm.id} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="rb-date-mode"
                      checked={filters.dateMode === dm.id}
                      onChange={() => onFiltersChange((f) => ({ ...f, dateMode: dm.id }))}
                    />
                    {dm.label}
                  </label>
                ))}
              </div>
            </div>
            <button
              ref={dateAnchorRef}
              type="button"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-9 shrink-0 gap-2 font-normal",
                dateOpen && "border-primary/60 bg-primary/5"
              )}
              onClick={() => setDateOpen((o) => !o)}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Период</span>
              <span className="text-sm font-medium tabular-nums">{periodBtn}</span>
            </button>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 shrink-0 p-0"
                title="Сбросить фильтры"
                onClick={() => onFiltersChange(defaultDatasetFilters())}
              >
                <Filter className="h-4 w-4" />
              </Button>
              {actions}
            </div>
          </div>

          <DateRangePopover
            open={dateOpen}
            onOpenChange={setDateOpen}
            anchorRef={dateAnchorRef}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onApply={({ dateFrom, dateTo }) => onFiltersChange((f) => ({ ...f, dateFrom, dateTo }))}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <FilterSelect
              placeholder="Агент"
              items={agentItems}
              selected={filters.agentIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, agentIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Категория"
              items={(filterOptions?.product_categories ?? []).map((c) => ({ id: String(c.id), title: c.name }))}
              selected={filters.categoryIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, categoryIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Группа"
              items={(filterOptions?.product_groups ?? []).map((g) => ({
                id: String(g.id),
                title: g.code ? `${g.code} — ${g.name}` : g.name
              }))}
              selected={filters.productGroupIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, productGroupIds: numSelected(ids) }))}
            />
            <FilterSelect placeholder="Продукт" items={productItems} selected={filters.productIds.map(String)} onChange={(ids) => onFiltersChange((f) => ({ ...f, productIds: numSelected(ids) }))} />
            <FilterSelect
              placeholder="Филиал"
              items={(filterOptions?.branches ?? []).map((b) => ({ id: b.id, title: b.label }))}
              selected={filters.branchValues}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, branchValues: Array.from(ids) }))}
            />
            <FilterSelect
              placeholder="Статус"
              items={(filterOptions?.statuses ?? []).map((s) => ({ id: s.id, title: s.label }))}
              selected={filters.statuses}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, statuses: Array.from(ids) }))}
            />
            <FilterSelect
              placeholder="Склад"
              items={(filterOptions?.warehouses ?? []).map((w) => ({
                id: String(w.id),
                title: w.code ? `${w.code} — ${w.name}` : w.name
              }))}
              selected={filters.warehouseIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, warehouseIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Экспедитор"
              items={(filterOptions?.expeditors ?? []).map((u) => ({
                id: String(u.id),
                title: u.code ? `${u.code} — ${u.name}` : u.name
              }))}
              selected={filters.expeditorUserIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, expeditorUserIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Бренд"
              items={(filterOptions?.brands ?? []).map((b) => ({
                id: String(b.id),
                title: b.code ? `${b.code} — ${b.name}` : b.name
              }))}
              selected={filters.brandIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, brandIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Категория клиента"
              items={(filterOptions?.client_categories ?? []).map((c) => ({ id: c.id, title: c.label }))}
              selected={filters.clientCategoryValues}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, clientCategoryValues: Array.from(ids) }))}
            />
            <FilterSelect
              placeholder="Тип цены"
              items={(filterOptions?.price_types ?? []).map((p) => ({ id: p.id, title: p.label }))}
              selected={filters.priceTypeRefs}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, priceTypeRefs: Array.from(ids) }))}
            />
            <FilterSelect
              placeholder="Оплата"
              items={(filterOptions?.payment_methods ?? []).map((p) => ({ id: p.id, title: p.label }))}
              selected={filters.paymentMethodRefs}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, paymentMethodRefs: Array.from(ids) }))}
            />
            <FilterSelect
              placeholder="Тип заказа"
              items={(filterOptions?.order_types ?? []).map((s) => ({ id: s.id, title: s.label }))}
              selected={filters.orderTypes}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, orderTypes: Array.from(ids) }))}
            />
            <FilterSelect
              placeholder="Супервайзер"
              items={(filterOptions?.supervisors ?? []).map((u) => ({
                id: String(u.id),
                title: u.code ? `${u.code} — ${u.name}` : u.name
              }))}
              selected={filters.supervisorUserIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, supervisorUserIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Направление"
              items={(filterOptions?.trade_directions ?? []).map((t) => ({
                id: String(t.id),
                title: t.code ? `${t.code} — ${t.name}` : t.name
              }))}
              selected={filters.tradeDirectionIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, tradeDirectionIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="KPI"
              items={(filterOptions?.kpi_groups ?? []).map((g) => ({
                id: String(g.id),
                title: g.code ? `${g.code} — ${g.name}` : g.name
              }))}
              selected={filters.kpiGroupIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, kpiGroupIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Клиент"
              items={(filterOptions?.clients ?? []).map((c) => ({
                id: String(c.id),
                title: c.code ? `${c.code} — ${c.name}` : c.name
              }))}
              selected={filters.clientIds.map(String)}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, clientIds: numSelected(ids) }))}
            />
            <FilterSelect
              placeholder="Зона"
              items={territory1Items}
              selected={filters.territoryLevel1Values}
              onChange={(ids) =>
                onFiltersChange((f) => ({
                  ...f,
                  territoryLevel1Values: Array.from(ids),
                  territoryLevel2Values: [],
                  territoryLevel3Values: []
                }))
              }
            />
            <FilterSelect
              placeholder="Область"
              items={territory2Items}
              selected={filters.territoryLevel2Values}
              onChange={(ids) =>
                onFiltersChange((f) => ({
                  ...f,
                  territoryLevel2Values: Array.from(ids),
                  territoryLevel3Values: []
                }))
              }
            />
            <FilterSelect
              placeholder="Город"
              items={territory3Items}
              selected={filters.territoryLevel3Values}
              onChange={(ids) => onFiltersChange((f) => ({ ...f, territoryLevel3Values: Array.from(ids) }))}
            />
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function FilterSelect({
  placeholder,
  items,
  selected,
  onChange
}: {
  placeholder: string;
  items: Array<{ id: string; title: string }>;
  selected: string[];
  onChange: (ids: Set<string>) => void;
}) {
  return (
    <div className="min-w-0">
      <SearchableMultiSelectPanel
        label={placeholder}
        hideOuterLabel
        hidePopoverHeader
        triggerPlaceholder={placeholder}
        triggerClassName="h-8 min-h-8 w-full text-xs font-normal shadow-sm"
        items={items}
        selected={new Set(selected)}
        onSelectedChange={(next) => {
          const s = typeof next === "function" ? next(new Set(selected)) : next;
          onChange(s);
        }}
        searchable
        searchPlaceholder={placeholder}
        minPopoverWidth={200}
        maxListHeightClass="max-h-36"
        selectAllLabel="Выбрать все"
      />
    </div>
  );
}

export { defaultDatasetFilters as defaultReportBuilderDatasetFilters };
