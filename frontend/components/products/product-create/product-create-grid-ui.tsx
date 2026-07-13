"use client";

import { PRODUCT_UNIT_OPTIONS } from "@/lib/product-units";
import { formatDecimalInputDisplay, sanitizeDecimalInput } from "@/lib/format-numbers";
import { cn } from "@/lib/utils";
import { ChevronDown, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { RefOption } from "./product-create-types";
import { formatVolumeLabel } from "./product-create-types";

export function LabelCell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[40px] items-center rounded-lg bg-[#eaf4f4] px-3 text-sm font-medium text-[#0c9899]">
      {children}
    </div>
  );
}

function FieldShell({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div className="relative w-full">
      {children}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-500 focus:border-[#07958f] focus:ring-2 focus:ring-[#07958f]/10";

export function GridTextInput({
  value,
  onChange,
  placeholder = "",
  error,
  maxLength,
  suffix,
  type = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
  suffix?: ReactNode;
  type?: "text" | "number";
}) {
  return (
    <FieldShell error={error}>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, error && "border-red-500", suffix && "pr-16")}
      />
      {suffix ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{suffix}</div>
      ) : null}
    </FieldShell>
  );
}

export function GridNumberInput({
  value,
  onChange,
  placeholder = "",
  compact = false
}: {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const raw = value === 0 ? "" : String(value);
  const display = formatDecimalInputDisplay(raw, { allowNegative: false, maxFractionDigits: 6 });
  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(event) => {
        const next = sanitizeDecimalInput(event.target.value, {
          allowNegative: false,
          maxFractionDigits: 6
        });
        onChange(next === "" ? 0 : Number(next));
      }}
      placeholder={placeholder}
      className={cn(
        compact ? "h-10 w-[112px]" : "h-10 w-full",
        "rounded-lg border border-slate-200 bg-white px-3 text-right text-sm tabular-nums tracking-tight text-slate-700 outline-none transition placeholder:text-slate-500 focus:border-[#07958f] focus:ring-2 focus:ring-[#07958f]/10"
      )}
    />
  );
}

export function GridSelectInput({
  value,
  onChange,
  options,
  placeholder = "",
  error
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  options: RefOption[];
  placeholder?: string;
  error?: string;
}) {
  return (
    <FieldShell error={error}>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(event) =>
            onChange(event.target.value ? Number(event.target.value) : null)
          }
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-[#07958f] focus:ring-2 focus:ring-[#07958f]/10",
            error ? "border-red-500" : "border-slate-200"
          )}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-3 text-slate-400">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    </FieldShell>
  );
}

export function GridUnitSelect({
  value,
  custom,
  onChange,
  onCustomChange,
  error
}: {
  value: string;
  custom: string;
  onChange: (value: string) => void;
  onCustomChange: (value: string) => void;
  error?: string;
}) {
  return (
    <FieldShell error={error}>
      <div className="space-y-2">
        <div className="relative">
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              "h-10 w-full appearance-none rounded-lg border bg-white px-3 pr-10 text-sm text-slate-700 outline-none transition focus:border-[#07958f] focus:ring-2 focus:ring-[#07958f]/10",
              error ? "border-red-500" : "border-slate-200"
            )}
          >
            {PRODUCT_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-3 text-slate-400">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
        {value === "__custom__" ? (
          <input
            value={custom}
            onChange={(event) => onCustomChange(event.target.value)}
            placeholder="Своя единица"
            className={inputCls}
          />
        ) : null}
      </div>
    </FieldShell>
  );
}

export function GridMultiSelect({
  value,
  onChange,
  options,
  placeholder = "",
  error
}: {
  value: number[];
  onChange: (value: number[]) => void;
  options: RefOption[];
  placeholder?: string;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((option) => value.includes(option.id));
  const label = selected.length
    ? selected.map((item) => item.name).join(", ")
    : placeholder;

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
      return;
    }
    onChange([...value, id]);
  }

  return (
    <FieldShell error={error}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm outline-none transition focus:border-[#07958f] focus:ring-2 focus:ring-[#07958f]/10",
            error ? "border-red-500" : "border-slate-200",
            selected.length ? "text-slate-700" : "text-slate-500"
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
        {open ? (
          <div className="absolute z-30 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(option.id)}
                  onChange={() => toggle(option.id)}
                  className="h-4 w-4 accent-[#07958f]"
                />
                <span>{option.name}</span>
              </label>
            ))}
            {options.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">Нет данных</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </FieldShell>
  );
}

export function GridSwitch({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "relative h-5 w-9 rounded-full transition",
        checked ? "bg-[#07958f]" : "bg-slate-300"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
          checked ? "left-[18px]" : "left-0.5"
        )}
      />
    </button>
  );
}

export function DefaultPackageBadge({
  active,
  onClick
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs transition",
        active ? "text-[#07958f]" : "text-slate-500 hover:text-[#07958f]"
      )}
      title="Сделать упаковкой по умолчанию"
    >
      По умол.
      <span className="text-sm">↺</span>
    </button>
  );
}

export function DeletePackageButton({
  disabled,
  onClick
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-red-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:text-red-200"
      title="Удалить объект"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

const PACKAGING_TEMPLATES = [
  { id: 1, name: "Коробка" },
  { id: 2, name: "Паллет" },
  { id: 3, name: "Пачка" }
] as const;

export function GridTemplateSelect({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <GridSelectInput
      value={PACKAGING_TEMPLATES.find((t) => t.name === value)?.id ?? null}
      onChange={(id) => {
        const hit = PACKAGING_TEMPLATES.find((t) => t.id === id);
        onChange(hit?.name ?? "");
      }}
      options={[...PACKAGING_TEMPLATES]}
      placeholder={value || "Выберите"}
    />
  );
}

export function VolumeInputs({
  width,
  height,
  length,
  onWidth,
  onHeight,
  onLength,
  unit = "m3",
  onUnit
}: {
  width: number;
  height: number;
  length: number;
  onWidth: (value: number) => void;
  onHeight: (value: number) => void;
  onLength: (value: number) => void;
  unit?: "m3" | "cm3";
  onUnit?: (unit: "m3" | "cm3") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <GridNumberInput value={width} onChange={onWidth} placeholder="Шири..." compact />
      <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-200 bg-white text-sm text-slate-500">
        +
      </span>
      <GridNumberInput value={height} onChange={onHeight} placeholder="Высот..." compact />
      <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-200 bg-white text-sm text-slate-500">
        +
      </span>
      <GridNumberInput value={length} onChange={onLength} placeholder="Длина..." compact />
      <span className="grid h-5 w-5 place-items-center rounded-full border border-slate-200 bg-white text-sm text-slate-500">
        =
      </span>
      <div className="grid h-10 min-w-[66px] place-items-center rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800">
        {formatVolumeLabel(width, height, length, unit)}
      </div>
      {onUnit ? (
        <div className="ml-1 flex rounded-lg bg-[#07958f] p-1 text-xs font-semibold text-white">
          <button
            type="button"
            onClick={() => onUnit("m3")}
            className={cn(
              "rounded-md px-2 py-1",
              unit === "m3" ? "bg-white text-[#057a76]" : "text-white"
            )}
          >
            m3
          </button>
          <button
            type="button"
            onClick={() => onUnit("cm3")}
            className={cn(
              "rounded-md px-2 py-1",
              unit === "cm3" ? "bg-white text-[#057a76]" : "text-white"
            )}
          >
            cm3
          </button>
        </div>
      ) : null}
    </div>
  );
}
