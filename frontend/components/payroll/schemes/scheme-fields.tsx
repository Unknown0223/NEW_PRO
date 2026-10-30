"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { money } from "@/lib/payroll/payroll-api";
import { COND_META, OP_LABEL, type Case, type Cond, type CondField, type CondOp } from "@/lib/payroll/payroll-scheme-types";
import { cn } from "@/lib/utils";

export type SchemeOptions = {
  branches: string[];
  positions: string[];
  tradeDirections: Array<{ id: number; name: string }>;
  items: Array<{ id: number; name: string; type: string; system_key: string | null; is_active: boolean }>;
  groups: Array<{ id: number; name: string }>;
};

export const SchemeOptionsCtx = createContext<SchemeOptions>({ branches: [], positions: [], tradeDirections: [], items: [], groups: [] });
export const useSchemeOptions = () => useContext(SchemeOptionsCtx);

export const MINI = "h-8 rounded-md border border-[var(--pr-input)] bg-card px-2 text-[12.5px] text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)] disabled:opacity-60";
export const MINI_LABEL = "text-[11px] font-medium text-muted-foreground";
export const LINK_BTN = "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-[var(--pr-brand-700)] hover:bg-[var(--pr-brand-50)] disabled:opacity-50";

/** `group` — ichida bir nechta tugma bo'lsa (label bosilganda birinchisi bosilmasin). */
export function Labeled({ label, children, className, group }: { label: string; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={cn("grid gap-0.5", className)}>
      <span className={MINI_LABEL}>{label}</span>
      {children}
    </Tag>
  );
}

/** Son maydoni: fokusda xom qiymat, fokussiz — guruhlangan. */
export function NumField({
  value,
  onChange,
  disabled,
  className,
  placeholder,
  allowNull
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  allowNull?: boolean;
}) {
  const [raw, setRaw] = useState<string | null>(null);
  const shown = raw ?? (value == null ? "" : money(value, 4));
  return (
    <input
      inputMode="decimal"
      disabled={disabled}
      placeholder={placeholder}
      className={cn(MINI, "tabular-nums", className)}
      value={shown}
      onFocus={() => setRaw(value == null ? "" : String(value))}
      onBlur={() => setRaw(null)}
      onChange={(e) => {
        setRaw(e.target.value);
        const s = e.target.value.replace(/\s/g, "").replace(",", ".");
        if (s === "") return onChange(allowNull ? null : 0);
        const n = Number(s);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export function ChipMulti<T extends string | number>({
  options,
  value,
  onChange,
  disabled,
  empty = "Все"
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (v: T[]) => void;
  disabled?: boolean;
  empty?: string;
}) {
  if (!options.length) return <span className="text-[12px] text-muted-foreground">Нет вариантов</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11.5px] transition-colors disabled:opacity-60",
              on ? "border-primary bg-[var(--pr-brand-50)] font-semibold text-[var(--pr-brand-700)]" : "border-[var(--pr-input)] text-foreground/70 hover:bg-muted"
            )}
          >
            {o.label}
          </button>
        );
      })}
      {!value.length ? <span className="self-center text-[11px] text-muted-foreground">· {empty}</span> : null}
    </div>
  );
}

function condOptions(field: CondField, o: SchemeOptions): Array<{ value: string | number; label: string }> {
  if (field === "branch") return o.branches.map((b) => ({ value: b, label: b }));
  if (field === "position") return o.positions.map((p) => ({ value: p, label: p }));
  if (field === "trade_direction") return o.tradeDirections.map((t) => ({ value: t.id, label: t.name }));
  return [];
}

export function condText(c: Cond, o: SchemeOptions): string {
  const meta = COND_META[c.field];
  if (Array.isArray(c.value)) {
    const opts = condOptions(c.field, o);
    const names = c.value.map((v) => opts.find((x) => x.value === v)?.label ?? String(v));
    return `${meta.label} ${OP_LABEL[c.op]}: ${names.join(", ") || "—"}`;
  }
  return `${meta.label} ${OP_LABEL[c.op]} ${c.value}${meta.unit ? ` ${meta.unit}` : ""}`;
}

function CondRow({ c, onChange, onRemove, disabled }: { c: Cond; onChange: (c: Cond) => void; onRemove: () => void; disabled?: boolean }) {
  const o = useSchemeOptions();
  const meta = COND_META[c.field];
  const ops: CondOp[] = meta.text ? ["in", "not_in"] : [">=", ">", "<=", "<", "="];
  const setField = (field: CondField) => onChange(COND_META[field].text ? { field, op: "in", value: [] } : { field, op: ">=", value: 0 });
  return (
    <div className="flex flex-wrap items-start gap-1.5 rounded-md bg-[var(--pr-head)] p-1.5">
      <select className={cn(MINI, "w-44")} value={c.field} disabled={disabled} onChange={(e) => setField(e.target.value as CondField)}>
        {(Object.keys(COND_META) as CondField[]).map((f) => (
          <option key={f} value={f}>
            {COND_META[f].label}
          </option>
        ))}
      </select>
      <select className={cn(MINI, "w-24")} value={c.op} disabled={disabled} onChange={(e) => onChange({ ...c, op: e.target.value as CondOp })}>
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABEL[op]}
          </option>
        ))}
      </select>
      {meta.text ? (
        <div className="min-w-0 flex-1 pt-1">
          <ChipMulti
            options={condOptions(c.field, o)}
            value={Array.isArray(c.value) ? c.value : []}
            onChange={(v) => onChange({ ...c, value: v })}
            disabled={disabled}
            empty="выберите"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <NumField className="w-24" value={typeof c.value === "number" ? c.value : 0} onChange={(v) => onChange({ ...c, value: v ?? 0 })} disabled={disabled} />
          <span className="text-[12px] text-muted-foreground">{meta.unit}</span>
        </div>
      )}
      <button type="button" disabled={disabled} onClick={onRemove} className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-rose-600" aria-label="Убрать условие">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** «ЕСЛИ» shartlari ro'yxati (hammasi bajarilishi kerak). */
export function CondList({ value, onChange, disabled, addLabel = "условие" }: { value: Cond[]; onChange: (v: Cond[]) => void; disabled?: boolean; addLabel?: string }) {
  return (
    <div className="grid gap-1">
      {value.map((c, i) => (
        <CondRow
          key={i}
          c={c}
          disabled={disabled}
          onChange={(n) => onChange(value.map((x, j) => (j === i ? n : x)))}
          onRemove={() => onChange(value.filter((_, j) => j !== i))}
        />
      ))}
      <div>
        <button type="button" className={LINK_BTN} disabled={disabled || value.length >= 10} onClick={() => onChange([...value, { field: "branch", op: "in", value: [] }])}>
          <Plus className="size-3.5" /> {value.length ? "И ещё " : "Добавить "}
          {addLabel}
        </button>
      </div>
    </div>
  );
}

/** «По условию другая сумма»: birinchi mos variant ishlaydi. */
export function CasesEditor({ value, onChange, disabled, unit = "сум" }: { value: Case[]; onChange: (v: Case[]) => void; disabled?: boolean; unit?: string }) {
  return (
    <div className="grid gap-2">
      {value.map((cs, i) => (
        <div key={i} className="grid gap-1.5 rounded-lg border border-dashed border-[var(--pr-border)] p-2">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-foreground/80">Вариант {i + 1}: сумма</span>
            <NumField className="w-36" value={cs.amount} onChange={(v) => onChange(value.map((x, j) => (j === i ? { ...x, amount: v ?? 0 } : x)))} disabled={disabled} />
            <span className="text-[12px] text-muted-foreground">{unit}, если</span>
            <button type="button" disabled={disabled} onClick={() => onChange(value.filter((_, j) => j !== i))} className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-rose-600" aria-label="Убрать вариант">
              <X className="size-3.5" />
            </button>
          </div>
          <CondList value={cs.when} onChange={(w) => onChange(value.map((x, j) => (j === i ? { ...x, when: w } : x)))} disabled={disabled} />
        </div>
      ))}
      <div>
        <button
          type="button"
          className={LINK_BTN}
          disabled={disabled || value.length >= 20}
          onClick={() => onChange([...value, { amount: 0, when: [{ field: "branch", op: "in", value: [] }] }])}
        >
          <Plus className="size-3.5" /> Другая сумма по условию
        </button>
      </div>
    </div>
  );
}
