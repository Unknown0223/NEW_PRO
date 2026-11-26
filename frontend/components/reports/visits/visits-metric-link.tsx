"use client";

import { formatCell } from "@/components/reports/flat-report/flat-report-helpers";

type Props = {
  value: unknown;
  onOpen: () => void;
};

/** 0 dan katta metrika — bosiladigan; aks holda oddiy matn. */
export function VisitsMetricLink({ value, onOpen }: Props) {
  const n = typeof value === "number" ? value : Number(value);
  const label = formatCell(value, "number");
  if (!Number.isFinite(n) || n <= 0) {
    return <span>{label}</span>;
  }
  return (
    <button
      type="button"
      className="text-sky-700 underline-offset-2 hover:underline"
      onClick={onOpen}
    >
      {label}
    </button>
  );
}
