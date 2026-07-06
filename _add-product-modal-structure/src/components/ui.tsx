import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

/* ---------- Field wrapper ---------- */
export function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-slate-600">
        {label}
        {required && <span className="text-rose-500">*</span>}
        {hint && <span className="ml-auto text-[11px] font-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* ---------- Input ---------- */
export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: ReactNode;
  error?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400",
          "focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300",
          suffix && "pr-11"
        )}
      />
      {suffix && (
        <span className="absolute inset-y-0 right-2 flex items-center">{suffix}</span>
      )}
    </div>
  );
}

/* ---------- Select (custom dropdown) ---------- */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Tanlang",
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3.5 text-sm outline-none transition-all",
          "focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300",
          value ? "text-slate-800" : "text-slate-400"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 max-h-52 w-full overflow-auto rounded-xl border border-slate-100 bg-white p-1 shadow-xl shadow-slate-900/10">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50",
                value === opt ? "font-medium text-teal-600" : "text-slate-700"
              )}
            >
              {opt}
              {value === opt && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- MultiSelect ---------- */
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Tanlang",
  error,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-2.5 py-1.5 text-sm outline-none transition-all",
          "focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10",
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300"
        )}
      >
        {values.length === 0 ? (
          <span className="px-1 text-slate-400">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {values.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700"
              >
                {v}
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(v);
                  }}
                  className="cursor-pointer text-teal-500 hover:text-teal-800"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 max-h-52 w-full overflow-auto rounded-xl border border-slate-100 bg-white p-1 shadow-xl shadow-slate-900/10">
          {options.map((opt) => {
            const selected = values.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                    selected ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 bg-white"
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Switch ---------- */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3"
    >
      <span
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors duration-200",
          checked ? "bg-teal-500" : "bg-slate-300"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200",
            checked ? "left-[22px]" : "left-0.5"
          )}
        />
      </span>
      {label && (
        <span className={cn("text-sm font-medium", checked ? "text-slate-800" : "text-slate-500")}>
          {label}
        </span>
      )}
    </button>
  );
}

/* ---------- Section title ---------- */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
      <span className="h-4 w-1 rounded-full bg-teal-500" />
      {children}
    </h3>
  );
}

/* ---------- Icons ---------- */
export const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const ChevronDown = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m6 9 6 6 6-6" /></svg>
);
export const Check = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M20 6 9 17l-5-5" /></svg>
);
export const X = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const Plus = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const Trash = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);
export const Barcode = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14" />
  </svg>
);
export const Box = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </svg>
);
export const Ruler = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0Z" />
    <path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" />
  </svg>
);
export const FileText = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);
export const Image = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </svg>
);
