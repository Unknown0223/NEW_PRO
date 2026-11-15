import type { ReactNode } from "react";
import type { FormulaFieldsState } from "@/hooks/use-formula-fields";
import { cx } from "./ui";

/** Inline katak, ustun sarlavhasi va ommaviy panel uchun ixcham formula maydonlari. */
export function FormulaFields({
  state,
  labelPrefix,
  disabled = false,
  autoFocus = false,
  trailing,
  onEnter
}: {
  state: FormulaFieldsState;
  labelPrefix: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Chipalar qatorining o‘ng tomoniga joylanadigan amallar (saqlash/qo‘llash). */
  trailing?: ReactNode;
  onEnter?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[minmax(0,1fr)_52px_84px] gap-1">
        <select
          aria-label={`${labelPrefix} asos`}
          className="h-7 min-w-0 rounded-md border border-[#d5e2da] bg-white px-1.5 text-[10px]"
          value={state.basis}
          disabled={disabled}
          onChange={(e) => state.setBasis(e.target.value as FormulaFieldsState["basis"])}
        >
          <option value="fact">Sof fakt</option>
          <option value="previous_plan">Eski reja</option>
        </select>
        <select
          aria-label={`${labelPrefix} usul`}
          className="h-7 rounded-md border border-[#d5e2da] bg-white px-1 text-[10px]"
          value={state.mode}
          disabled={disabled}
          onChange={(e) => state.setMode(e.target.value as FormulaFieldsState["mode"])}
        >
          <option value="percent">%</option>
          <option value="amount">so‘m</option>
        </select>
        <input
          aria-label={`${labelPrefix} qiymat`}
          className={cx(
            "numeric h-7 min-w-0 rounded-md border bg-white px-1.5 text-[11px] font-semibold",
            state.error ? "border-red-300" : "border-[#d5e2da]"
          )}
          inputMode="decimal"
          autoFocus={autoFocus && !disabled}
          value={state.raw}
          disabled={disabled}
          onChange={(e) => state.setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter?.();
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {(state.mode === "percent" ? [5, 10, 15, 20] : [500000, 1000000, 5000000]).map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            className="rounded border border-[#dbe6df] bg-white px-1 py-px text-[8px] leading-3 text-[#6d8375] hover:border-brand-300 hover:text-brand-700"
            onClick={() => state.setRaw(String(n))}
          >
            +{state.mode === "percent" ? `${n}%` : `${n / 1000000} mln`}
          </button>
        ))}
        {trailing && <span className="ml-auto flex items-center gap-1">{trailing}</span>}
      </div>
      {state.error && <p className="text-[9px] leading-3 text-red-600">{state.error}</p>}
    </div>
  );
}
