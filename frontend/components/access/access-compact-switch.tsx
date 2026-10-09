"use client";

export function AccessCompactSwitch({
  checked,
  disabled,
  title,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center" title={title}>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        aria-label={title}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pointer-events-none absolute inset-0 rounded-full bg-muted transition-colors peer-checked:bg-teal-600 peer-disabled:opacity-50" />
      <span className="pointer-events-none absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-card shadow ring-1 ring-black/10 transition-transform peer-checked:translate-x-4 peer-disabled:opacity-70" />
    </label>
  );
}
