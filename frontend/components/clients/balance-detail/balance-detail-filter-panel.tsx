"use client";

import { X } from "lucide-react";
import type { BalanceDetailFilters } from "@/lib/client-balance-detail/types";

type Props = {
  filters: BalanceDetailFilters;
  onChange: (f: BalanceDetailFilters) => void;
  agentOptions: string[];
  expeditorOptions: string[];
  cashboxOptions: string[];
  creatorOptions: string[];
};

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
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "border-[#1aa096] bg-[#e6f7f5] text-[#1aa096]"
          : "border-[#d0d5dd] bg-white text-[#666] hover:border-[#aaa]"
      }`}
    >
      {label}
    </button>
  );
}

export function BalanceDetailFilterPanel({
  filters,
  onChange,
  agentOptions,
  expeditorOptions,
  cashboxOptions,
  creatorOptions
}: Props) {
  const toggleArr = (key: keyof Pick<BalanceDetailFilters, "types" | "paymentMethods" | "agents" | "expeditors">, val: string) => {
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

  return (
    <div className="space-y-2 border-b border-[#e5e7eb] bg-[#f9fafb] px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Тип строки</span>
        <Chip label="Все" active={filters.rowKind === "all"} onClick={() => onChange({ ...filters, rowKind: "all" })} />
        <Chip label="Долг" active={filters.rowKind === "debt"} onClick={() => onChange({ ...filters, rowKind: "debt" })} />
        <Chip label="Оплата" active={filters.rowKind === "payment"} onClick={() => onChange({ ...filters, rowKind: "payment" })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Тип</span>
        {["Заказ", "Оплата", "Расход"].map((t) => (
          <Chip key={t} label={t} active={filters.types.includes(t)} onClick={() => toggleArr("types", t)} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Способ оплаты</span>
        {["Наличные", "Перечисление", "Терминал"].map((t) => (
          <Chip key={t} label={t} active={filters.paymentMethods.includes(t)} onClick={() => toggleArr("paymentMethods", t)} />
        ))}
      </div>
      {agentOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Агент</span>
          {agentOptions.map((a) => (
            <Chip key={a} label={a} active={filters.agents.includes(a)} onClick={() => toggleArr("agents", a)} />
          ))}
        </div>
      ) : null}
      {expeditorOptions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Экспедитор</span>
          {expeditorOptions.map((e) => (
            <Chip key={e} label={e} active={filters.expeditors.includes(e)} onClick={() => toggleArr("expeditors", e)} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">Консигнация</span>
        <Chip label="Все" active={filters.consignment === ""} onClick={() => onChange({ ...filters, consignment: "" })} />
        <Chip label="Да" active={filters.consignment === "yes"} onClick={() => onChange({ ...filters, consignment: "yes" })} />
        <Chip label="Нет" active={filters.consignment === "no"} onClick={() => onChange({ ...filters, consignment: "no" })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {cashboxOptions.length > 0 ? (
          <select
            value={filters.cashbox}
            onChange={(e) => onChange({ ...filters, cashbox: e.target.value })}
            className="h-7 rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
          >
            <option value="">Все кассы</option>
            {cashboxOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="text"
          placeholder="Комментарий"
          value={filters.comment}
          onChange={(e) => onChange({ ...filters, comment: e.target.value })}
          className="h-7 min-w-[120px] rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
        />
        {creatorOptions.length > 0 ? (
          <select
            value={filters.createdBy}
            onChange={(e) => onChange({ ...filters, createdBy: e.target.value })}
            className="h-7 rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
          >
            <option value="">Все создатели</option>
            {creatorOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="number"
          placeholder="Долг от"
          value={filters.debtMin}
          onChange={(e) => onChange({ ...filters, debtMin: e.target.value })}
          className="h-7 w-20 rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
        />
        <input
          type="number"
          placeholder="Долг до"
          value={filters.debtMax}
          onChange={(e) => onChange({ ...filters, debtMax: e.target.value })}
          className="h-7 w-20 rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
        />
        <input
          type="number"
          placeholder="Оплата от"
          value={filters.paymentMin}
          onChange={(e) => onChange({ ...filters, paymentMin: e.target.value })}
          className="h-7 w-20 rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
        />
        <input
          type="number"
          placeholder="Оплата до"
          value={filters.paymentMax}
          onChange={(e) => onChange({ ...filters, paymentMax: e.target.value })}
          className="h-7 w-20 rounded border border-[#d0d5dd] bg-white px-2 text-[11px]"
        />
        {hasActive ? (
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
            className="flex items-center gap-1 text-[11px] text-red-600 hover:underline"
          >
            <X className="h-3 w-3" />
            Сбросить
          </button>
        ) : null}
      </div>
    </div>
  );
}
