"use client";

import { cn } from "@/lib/utils";
import type { ReactNode, SelectHTMLAttributes } from "react";

type FloatingShellProps = {
  label: string;
  children: ReactNode;
  className?: string;
  faded?: boolean;
  htmlFor?: string;
};

export function BonusRuleSection({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      {children}
    </section>
  );
}

export function BonusRuleSectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-xl font-bold tracking-tight text-foreground">{children}</h2>;
}

export function BonusRuleFloatingField({ label, children, className, faded, htmlFor }: FloatingShellProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "relative block min-w-0 rounded-xl border bg-card px-3 pb-2.5 pt-4",
        faded ? "border-border/50 text-muted-foreground/70" : "border-border text-foreground",
        className
      )}
    >
      <span className="absolute -top-2 left-3 bg-card px-1 text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function BonusRuleFloatingInput({
  label,
  className,
  inputClassName,
  faded,
  ...props
}: Omit<FloatingShellProps, "children" | "htmlFor"> &
  React.InputHTMLAttributes<HTMLInputElement> & { inputClassName?: string }) {
  const { id, ...rest } = props;
  return (
    <BonusRuleFloatingField label={label} faded={faded} htmlFor={id} className={className}>
      <input
        id={id}
        className={cn(
          "min-h-5 w-full min-w-0 bg-transparent text-sm outline-none",
          rest.type === "datetime-local" ? "h-6" : "h-5",
          faded ? "text-muted-foreground/60" : "text-foreground",
          inputClassName
        )}
        {...rest}
      />
    </BonusRuleFloatingField>
  );
}

export function BonusRuleFloatingSelect({
  label,
  className,
  selectClassName,
  faded,
  children,
  ...props
}: Omit<FloatingShellProps, "children" | "htmlFor"> &
  SelectHTMLAttributes<HTMLSelectElement> & {
    selectClassName?: string;
    children: ReactNode;
  }) {
  const { id, ...rest } = props;
  return (
    <BonusRuleFloatingField label={label} faded={faded} htmlFor={id} className={className}>
      <div className="flex h-5 items-center justify-between gap-2">
        <select
          id={id}
          className={cn(
            "min-w-0 flex-1 appearance-none bg-transparent text-sm outline-none",
            faded ? "text-muted-foreground/60" : "text-foreground",
            selectClassName
          )}
          {...rest}
        >
          {children}
        </select>
        <svg className="h-4 w-4 shrink-0 text-muted-foreground/50" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="m6 8 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </BonusRuleFloatingField>
  );
}

export function BonusRuleTemplateCheckbox({
  checked,
  muted = false,
  disabled,
  onChange,
  label,
  id
}: {
  checked: boolean;
  muted?: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  id?: string;
}) {
  const box = (
    <span
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border text-white transition",
        checked
          ? "border-teal-600 bg-teal-600 dark:border-teal-500 dark:bg-teal-500"
          : muted
            ? "border-muted bg-muted/50"
            : "border-border bg-muted/30"
      )}
    >
      {checked ? (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="m3.5 8 3 3 6-6.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );

  if (!onChange) return box;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 text-sm",
        muted && !checked ? "text-muted-foreground/70" : "text-foreground/90",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {box}
      {label ? <span>{label}</span> : null}
    </label>
  );
}

function TemplateRadioDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-4 w-4 shrink-0 rounded-full border-2",
        active
          ? "border-teal-500 bg-teal-500 shadow-[inset_0_0_0_3px_hsl(var(--card))] dark:border-teal-400 dark:bg-teal-400"
          : "border-cyan-500/80 bg-transparent dark:border-cyan-400/70"
      )}
    />
  );
}

export function BonusRuleTemplateRadioGroup({
  title,
  name,
  options,
  value,
  onChange,
  disabled
}: {
  title: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative flex min-h-10 flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-3 py-2 text-sm shadow-sm">
      <span className="absolute -top-2 left-3 bg-card px-1 text-xs text-muted-foreground">{title}</span>
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-foreground/90",
            disabled && "cursor-not-allowed opacity-60"
          )}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
          />
          <TemplateRadioDot active={value === option.value} />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function BonusRuleTemplateButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button"
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition disabled:opacity-60",
        variant === "primary"
          ? "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          : "border border-border bg-card text-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}

export function BonusRulePreviewQtyInput({
  value,
  onChange,
  disabled,
  id = "br-preview-qty"
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      className="h-10 w-24 rounded-lg border border-border bg-card px-3 text-right text-sm outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30"
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}
