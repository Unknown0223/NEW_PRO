import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ClipboardCheck, Sparkles } from "lucide-react";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------------ */
/*  Scroll reveal                                                      */
/* ------------------------------------------------------------------ */

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "scale";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(variant === "scale" ? "reveal-scale" : "reveal", visible && "is-in", className)}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

type ToastFn = (message: string, tone?: "success" | "info") => void;
const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; tone: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback<ToastFn>((message, tone = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            className="toast-in pointer-events-auto flex items-center gap-2.5 rounded-full border border-white/10 bg-midnight px-4 py-3 text-[13px] font-medium text-white shadow-[0_24px_60px_-20px_rgba(6,33,30,0.8)]"
          >
            <span className="grid size-6 place-items-center rounded-full bg-lime text-midnight">
              <Check size={14} strokeWidth={3} />
            </span>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Logo                                                              */
/* ------------------------------------------------------------------ */

export function Logo({
  compact = false,
  invert = false,
  onClick,
}: {
  compact?: boolean;
  invert?: boolean;
  onClick?: () => void;
}) {
  return (
    <a href="#top" onClick={onClick} className="group flex items-center gap-2.5" aria-label="SALEC Design Studio">
      <span className="relative grid size-10 place-items-center overflow-hidden rounded-[13px] bg-gradient-to-br from-brand-500 to-brand-800 shadow-[0_8px_20px_-8px_rgba(7,129,121,0.75)] transition-transform duration-500 group-hover:rotate-6">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z" stroke="#C8F56A" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 7.5 16.5 12 12 16.5 7.5 12 12 7.5Z" fill="#EAF8F5" />
          <circle cx="12" cy="12" r="1.4" fill="#06211E" />
        </svg>
        <span className="absolute -right-2 -top-2 size-6 rounded-full bg-lime/40 blur-md" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-[17px] font-bold tracking-[-0.02em]", invert ? "text-white" : "text-ink")}>
          SALEC<span className={invert ? "text-lime" : "text-brand-500"}>.</span>
        </span>
        {!compact && (
          <span className={cn("mt-1 font-mono text-[9px] uppercase tracking-[0.24em]", invert ? "text-white/40" : "text-muted")}>
            design studio
          </span>
        )}
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/*  Section heading                                                    */
/* ------------------------------------------------------------------ */

export function SectionHead({
  eyebrow,
  title,
  description,
  right,
  dark = false,
  center = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  right?: ReactNode;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        center && "md:flex-col md:items-center md:text-center",
      )}
    >
      <div className={cn("max-w-2xl", center && "mx-auto")}>
        <div
          className={cn(
            "mb-4 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
            dark ? "border-lime/20 bg-lime/10 text-lime" : "border-brand-200/70 bg-white/70 text-brand-700",
          )}
        >
          <Sparkles size={11} />
          {eyebrow}
        </div>
        <h2
          className={cn(
            "font-display text-[30px] leading-[1.06] font-semibold tracking-[-0.035em] text-balance sm:text-[38px] md:text-[44px]",
            dark ? "text-white" : "text-ink",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className={cn("mt-4 max-w-xl text-[14px] leading-relaxed sm:text-[15px]", dark ? "text-white/60" : "text-ink-2/80")}>
            {description}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badges & buttons                                                   */
/* ------------------------------------------------------------------ */

export function Badge({
  children,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  tone?: "brand" | "lime" | "coral" | "neutral" | "dark";
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700 border-brand-200/70",
    lime: "bg-lime/20 text-brand-900 border-lime/40",
    coral: "bg-coral/10 text-coral border-coral/25",
    neutral: "bg-white/70 text-ink-2 border-line",
    dark: "bg-white/8 text-white/80 border-white/12",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CopyButton({
  value,
  label = "",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable — still give feedback */
    }
    setCopied(true);
    toast(`${value} nusxalandi`);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 font-mono text-[11px] text-ink-2 transition hover:border-brand-300 hover:text-brand-700",
        className,
      )}
      aria-label={`${value} ni nusxalash`}
    >
      {copied ? (
        <ClipboardCheck size={12} className="text-brand-600" />
      ) : value.startsWith("#") ? (
        <span className="size-3 rounded-full ring-1 ring-black/10" style={{ background: value }} />
      ) : null}
      {label || value}
    </button>
  );
}

export function LiveBadge({ dark = false, label = "Live" }: { dark?: boolean; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        dark ? "border-white/15 bg-white/10 text-white" : "border-line bg-white text-ink-2",
      )}
    >
      <span className={cn("live-dot size-1.5 rounded-full", dark ? "bg-lime text-lime" : "bg-brand-500 text-brand-500")} />
      {label}
    </span>
  );
}
