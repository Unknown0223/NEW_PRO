"use client";

type Props = {
  compact?: boolean;
  outcome: "success" | "failure" | null;
  phase: "liveness" | "align" | "sending";
  busy?: boolean;
  total: number;
  stepNum: number;
  stepIdx: number;
  doneCount: number;
  statusTitle: string;
  hint: string;
  titleClass: string;
  shownProgress: number;
  detectorReady: boolean;
  detectorError: string | null;
  showManual: boolean;
  manualLabel: string;
  manualDisabled: boolean;
  onManual: () => void;
};

export function FaceLivenessStatus({
  compact,
  outcome,
  phase,
  busy,
  total,
  stepNum,
  stepIdx,
  doneCount,
  statusTitle,
  hint,
  titleClass,
  shownProgress,
  detectorReady,
  detectorError,
  showManual,
  manualLabel,
  manualDisabled,
  onManual
}: Props) {
  const verifying = phase === "sending" || Boolean(busy);
  return (
    <>
      <div className="text-center">
        {!outcome ? (
          <div className="mb-1.5 flex items-center justify-center gap-1.5">
            {Array.from({ length: Math.max(total, 1) }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < doneCount
                    ? "w-4 bg-emerald-500"
                    : i === stepIdx && phase === "liveness"
                      ? "w-5 bg-teal-500"
                      : verifying || phase === "align"
                        ? "w-4 bg-teal-400"
                        : "w-2.5 bg-slate-200"
                }`}
              />
            ))}
            <span
              className={`h-1.5 rounded-full transition-all duration-300 ${
                verifying || outcome === "success" ? "w-4 bg-emerald-500" : "w-2.5 bg-slate-200"
              }`}
              title="Сервер"
            />
          </div>
        ) : null}
        {phase === "liveness" && !outcome ? (
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Шаг {stepNum} из {total}
          </p>
        ) : null}
        <p className={`font-semibold ${titleClass} ${compact ? "mt-0.5 text-lg" : "mt-1 text-base"}`}>
          {statusTitle}
        </p>
        <p className={`text-slate-500 ${compact ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>{hint}</p>
        {detectorReady && !detectorError && phase === "liveness" && !outcome ? (
          <div className="mx-auto mt-2 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-teal-500 transition-[width] duration-100"
              style={{ width: `${Math.round(shownProgress * 100)}%` }}
            />
          </div>
        ) : null}
        {verifying && !outcome ? (
          <div className="mx-auto mt-2 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-slate-200">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-teal-500" />
          </div>
        ) : null}
      </div>
      {showManual ? (
        <button
          type="button"
          disabled={manualDisabled}
          onClick={onManual}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          {manualLabel}
        </button>
      ) : null}
    </>
  );
}
