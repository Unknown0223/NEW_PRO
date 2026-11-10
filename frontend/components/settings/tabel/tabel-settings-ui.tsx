"use client";

import { Input } from "@/components/ui/input";

export type TabelSettingsDict = Record<string, any>;

/**
 * Bo'lim sarlavhasi (h1 + izoh).
 * Barcha tabларда bir xil ko'rinish uchun.
 */
export function TabelSectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h1 className="text-base font-bold">{title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Bo'lim kartasi: border + card + padding. Har bir tab shu konteynerda.
 */
export function TabelSectionCard({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">{children}</div>;
}

/**
 * Matn/izoh bilan checkbox qatori.
 * `checked` uchlik holatni qo'llab-quvvatlaydi: `undefined`/`null` → default holat
 * (`defaultChecked`), aks holda aniq qiymat.
 */
export function TabelCheckRow({
  title,
  hint,
  checked,
  onChange,
  disabled
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 rounded-lg border bg-background px-3 py-2 text-xs">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>
        <span className="font-semibold">{title}</span>
        <span className="mt-0.5 block text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/**
 * Sanoqli maydon: label + Input[type=number] + izoh.
 * `min`/`max`/`step` ni ham beradi, shuning uchun har bir sozlama bir xil ko'rinadi.
 */
export function TabelNumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  disabled
}: {
  label: string;
  hint?: string;
  value: number | string;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Tanlov maydoni (native select; `h-9` uslubi boshqa formalar bilan bir xil).
 */
export function TabelSelectField({
  label,
  hint,
  value,
  onChange,
  children,
  disabled,
  className
}: {
  label: string;
  hint?: string;
  value: string | number;
  onChange: (next: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {children}
      </select>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
