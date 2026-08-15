"use client";

import { filterPanelSelectClassName } from "@/components/ui/filter-select";
import type { BalanceDetailFilters } from "@/lib/client-balance-detail/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  filters: BalanceDetailFilters;
  onChange: (f: BalanceDetailFilters) => void;
  agentOptions: string[];
  expeditorOptions: string[];
  cashboxOptions: string[];
  creatorOptions: string[];
};

const FIELD_INPUT =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Chip({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 shrink-0 rounded-md border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex min-h-9 flex-wrap content-center items-center gap-1.5">{children}</div>;
}

export function BalanceDetailFilterPanel({
  filters,
  onChange,
  agentOptions,
  expeditorOptions,
  cashboxOptions,
  creatorOptions
}: Props) {
  const toggleArr = (
    key: keyof Pick<BalanceDetailFilters, "types" | "paymentMethods" | "agents" | "expeditors">,
    val: string
  ) => {
    const arr = filters[key];
    const next = arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
    onChange({ ...filters, [key]: next });
  };

  const hasActive =
    filters.types.length > 0 ||
    filters.paymentMethods.length > 0 ||
    filters.agents.length > 0 ||
    filters.expeditors.length > 0 ||
    filters.consignment !== "" ||
    filters.cashbox !== "" ||
    filters.comment !== "" ||
    filters.createdBy !== "" ||
    filters.debtMin !== "" ||
    filters.debtMax !== "" ||
    filters.paymentMin !== "" ||
    filters.paymentMax !== "" ||
    filters.rowKind !== "all";

  const gridClass = "grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";

  return (
    <div className="border-b border-border/70 bg-muted/30 px-3 py-3 sm:px-4">
      <div className={gridClass}>
        <div className="orders-filter-field-label">
          Тип строки
          <ChipGroup>
            <Chip
              label="Все"
              active={filters.rowKind === "all"}
              onClick={() => onChange({ ...filters, rowKind: "all" })}
            />
            <Chip
              label="Долг"
              active={filters.rowKind === "debt"}
              onClick={() => onChange({ ...filters, rowKind: "debt" })}
            />
            <Chip
              label="Оплата"
              active={filters.rowKind === "payment"}
              onClick={() => onChange({ ...filters, rowKind: "payment" })}
            />
          </ChipGroup>
        </div>

        <div className="orders-filter-field-label">
          Тип
          <ChipGroup>
            {["Заказ", "Оплата", "Расход"].map((t) => (
              <Chip
                key={t}
                label={t}
                active={filters.types.includes(t)}
                onClick={() => toggleArr("types", t)}
              />
            ))}
          </ChipGroup>
        </div>

        <div className="orders-filter-field-label">
          Способ оплаты
          <ChipGroup>
            {["Наличные", "Перечисление", "Терминал"].map((t) => (
              <Chip
                key={t}
                label={t}
                active={filters.paymentMethods.includes(t)}
                onClick={() => toggleArr("paymentMethods", t)}
              />
            ))}
          </ChipGroup>
        </div>

        <div className="orders-filter-field-label">
          Консигнация
          <ChipGroup>
            <Chip
              label="Все"
              active={filters.consignment === ""}
              onClick={() => onChange({ ...filters, consignment: "" })}
            />
            <Chip
              label="Да"
              active={filters.consignment === "yes"}
              onClick={() => onChange({ ...filters, consignment: "yes" })}
            />
            <Chip
              label="Нет"
              active={filters.consignment === "no"}
              onClick={() => onChange({ ...filters, consignment: "no" })}
            />
          </ChipGroup>
        </div>

        {agentOptions.length > 0 ? (
          <div className="orders-filter-field-label sm:col-span-2 md:col-span-1 lg:col-span-2">
            Агент
            <ChipGroup>
              {agentOptions.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  active={filters.agents.includes(a)}
                  onClick={() => toggleArr("agents", a)}
                />
              ))}
            </ChipGroup>
          </div>
        ) : null}

        {expeditorOptions.length > 0 ? (
          <div className="orders-filter-field-label sm:col-span-2 md:col-span-1 lg:col-span-2">
            Экспедитор
            <ChipGroup>
              {expeditorOptions.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  active={filters.expeditors.includes(e)}
                  onClick={() => toggleArr("expeditors", e)}
                />
              ))}
            </ChipGroup>
          </div>
        ) : null}

        {cashboxOptions.length > 0 ? (
          <label className="orders-filter-field-label">
            Касса
            <select
              value={filters.cashbox}
              onChange={(e) => onChange({ ...filters, cashbox: e.target.value })}
              className={cn(filterPanelSelectClassName, "h-9 min-h-9 min-w-0 max-w-none")}
            >
              <option value="">Все кассы</option>
              {cashboxOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {creatorOptions.length > 0 ? (
          <label className="orders-filter-field-label">
            Создатель
            <select
              value={filters.createdBy}
              onChange={(e) => onChange({ ...filters, createdBy: e.target.value })}
              className={cn(filterPanelSelectClassName, "h-9 min-h-9 min-w-0 max-w-none")}
            >
              <option value="">Все создатели</option>
              {creatorOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="orders-filter-field-label sm:col-span-2 md:col-span-1 lg:col-span-2">
          Комментарий
          <input
            type="text"
            placeholder="Поиск по комментарию"
            value={filters.comment}
            onChange={(e) => onChange({ ...filters, comment: e.target.value })}
            className={FIELD_INPUT}
          />
        </label>

        <label className="orders-filter-field-label">
          Долг от
          <input
            type="number"
            placeholder="0"
            value={filters.debtMin}
            onChange={(e) => onChange({ ...filters, debtMin: e.target.value })}
            className={FIELD_INPUT}
          />
        </label>

        <label className="orders-filter-field-label">
          Долг до
          <input
            type="number"
            placeholder="0"
            value={filters.debtMax}
            onChange={(e) => onChange({ ...filters, debtMax: e.target.value })}
            className={FIELD_INPUT}
          />
        </label>

        <label className="orders-filter-field-label">
          Оплата от
          <input
            type="number"
            placeholder="0"
            value={filters.paymentMin}
            onChange={(e) => onChange({ ...filters, paymentMin: e.target.value })}
            className={FIELD_INPUT}
          />
        </label>

        <label className="orders-filter-field-label">
          Оплата до
          <input
            type="number"
            placeholder="0"
            value={filters.paymentMax}
            onChange={(e) => onChange({ ...filters, paymentMax: e.target.value })}
            className={FIELD_INPUT}
          />
        </label>
      </div>

      {hasActive ? (
        <div className="mt-3 flex justify-end border-t border-border/60 pt-2.5">
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                types: [],
                paymentMethods: [],
                agents: [],
                expeditors: [],
                consignment: "",
                cashbox: "",
                comment: "",
                createdBy: "",
                debtMin: "",
                debtMax: "",
                paymentMin: "",
                paymentMax: "",
                rowKind: "all"
              })
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Сбросить фильтры
          </button>
        </div>
      ) : null}
    </div>
  );
}
