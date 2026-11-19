import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes
} from "react";
import { X, Inbox, ChevronDown } from "lucide-react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};
export function Button({
  variant = "secondary",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={cx("btn", `btn-${variant}`, className)} {...props} />;
}

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "green" | "amber" | "red" | "neutral" | "blue";
  className?: string;
}) {
  const tones = {
    green: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-600",
    neutral: "bg-[#f0f3f1] text-[#7b8880]",
    blue: "bg-sky-50 text-sky-700"
  };
  return <span className={cx("badge", tones[tone], className)}>{children}</span>;
}

export function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  disabled = false,
  className
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      className={cx("size-3.5 shrink-0", className)}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block min-w-0", className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-[#8b968f]">{hint}</span>}
    </label>
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cx("field appearance-none pr-8", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        size={13}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[#8a978e]"
      />
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-lg border border-[#e1e7e3] bg-[#f5f7f6] p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition",
            value === o.value
              ? "bg-white text-brand-700 shadow-xs ring-1 ring-black/5"
              : "text-[#89958d] hover:text-[#4c6256]"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
  xwide = false
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
  xwide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-32px)] overflow-hidden rounded-2xl border border-white/60 bg-white p-0 text-[#263e35] shadow-2xl backdrop:bg-[#10241c]/45 backdrop:backdrop-blur-[3px]",
        xwide ? "max-w-5xl" : wide ? "max-w-3xl" : "max-w-lg"
      )}
    >
      <div className="flex items-start justify-between border-b border-[#e8ede9] px-6 py-5">
        <div>
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-xs leading-5 text-[#859188]">{subtitle}</p>}
        </div>
        <button className="icon-btn -mr-1" onClick={onClose} aria-label="Yopish">
          <X size={17} />
        </button>
      </div>
      <div className="max-h-[calc(90dvh-90px)] overflow-y-auto p-6">{children}</div>
    </dialog>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
        <Inbox size={21} />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[#8a968e]">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="relative mt-0.5 h-[18px] w-8 shrink-0 rounded-full bg-[#dce4df] transition peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 after:absolute after:top-[3px] after:left-[3px] after:size-3 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-3.5" />
      <span>
        <span className="block text-xs font-medium text-[#506459]">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[10px] leading-4 text-[#919b95]">{description}</span>
        )}
      </span>
    </label>
  );
}
