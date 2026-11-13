"use client";

type Props = {
  /** 0..1 turn progress or align hold */
  progress?: number;
  mode: "scan" | "align" | "server" | "success" | "failure";
  compact?: boolean;
};

/** Animated ring / spinner over the face oval for Face ID stages. */
export function FaceScanIndicator({ progress = 0, mode, compact }: Props) {
  const size = compact ? "h-16 w-16" : "h-14 w-14";
  const stroke = compact ? 3.2 : 2.8;
  const r = 18;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  const dash = c * (1 - p);

  if (mode === "success" || mode === "failure") {
    return (
      <span
        className={`flex items-center justify-center rounded-full text-white shadow-xl ring-4 ${size} animate-in zoom-in-50 duration-300 ${
          mode === "success"
            ? "bg-emerald-500 ring-emerald-200/60"
            : "bg-red-500 ring-red-200/60"
        }`}
      >
        {mode === "success" ? (
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
    );
  }

  if (mode === "server") {
    return (
      <span
        className={`relative flex items-center justify-center rounded-full bg-slate-900/70 text-teal-300 shadow-xl ring-4 ring-teal-200/40 ${size}`}
      >
        <span className="absolute inset-1 animate-spin rounded-full border-2 border-teal-400/30 border-t-teal-300" />
        <svg viewBox="0 0 24 24" className="relative h-6 w-6" fill="none">
          <path
            d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className={`relative flex items-center justify-center ${size}`}>
      <span
        className={`absolute inset-0 rounded-full ${
          mode === "align" ? "animate-ping bg-teal-400/25" : "animate-pulse bg-teal-500/20"
        }`}
      />
      <svg viewBox="0 0 48 48" className="relative h-full w-full -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={stroke}
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={mode === "align" ? "#2dd4bf" : "#14b8a6"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dash}
          className="transition-[stroke-dashoffset] duration-100"
        />
      </svg>
    </span>
  );
}
