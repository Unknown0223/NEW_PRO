import { OUTCOME_METHODS, type OutcomeVerdict } from "@salec/plans-proposal";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatPercent } from "@/lib/audit";
import { fmt } from "@/lib/format";
import {
  METHOD_SHORT,
  closestMethod,
  draftJustified,
  usableActual,
  type OutcomeRow
} from "@/lib/outcome-rows";
import { Badge, cx } from "./ui";

const TONES: Record<OutcomeVerdict, "green" | "red" | "amber" | "neutral"> = {
  justified: "green",
  over: "red",
  under: "amber",
  no_data: "neutral"
};

export function VerdictBadge({
  verdict,
  short = false
}: {
  verdict: OutcomeVerdict;
  short?: boolean;
}) {
  const text = short
    ? { justified: "Oqladi", over: "Yuqori", under: "Past", no_data: "—" }[verdict]
    : {
        justified: "O‘zini oqladi",
        over: "Oqlanmadi · yuqori",
        under: "Oqlanmadi · past",
        no_data: "Ma’lumot yo‘q"
      }[verdict];
  return <Badge tone={TONES[verdict]}>{text}</Badge>;
}

function deviationTone(verdict: OutcomeVerdict): string {
  return verdict === "over"
    ? "text-red-600"
    : verdict === "under"
      ? "text-amber-600"
      : "text-[#8b9a90]";
}

type CellProps = {
  row: OutcomeRow | undefined;
  id: number;
  employeeName: string;
  onExpand: (id: number) => void;
};

/** Yopiq KPI ustuni: jami haqiqiy fakt + joriy draft xulosasi. */
export function OutcomeCompactCell({ row, id, employeeName, onExpand }: CellProps) {
  const verdict = row?.verdicts.draft ?? "no_data";
  return (
    <td key={id} className="px-2 py-1.5 align-top">
      <button
        type="button"
        aria-label={`${employeeName} KPI ${id} natijasi`}
        title="KPI ustunini kengaytirib usullar tafsilotini ko‘rish"
        onClick={() => onExpand(id)}
        className="w-full rounded-md border border-transparent px-2 py-1 text-left transition hover:border-brand-200 hover:bg-brand-50/50"
      >
        <span
          className={cx(
            "numeric block text-[11px] font-bold",
            usableActual(row?.actual ?? null) > 0n ? "text-brand-700" : "text-[#b1bbb4]"
          )}
        >
          {fmt(row?.actual)}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[8px] text-[#93a198]">
          <span
            className={cx(
              "size-1.5 shrink-0 rounded-full",
              verdict === "justified"
                ? "bg-brand-500"
                : verdict === "over"
                  ? "bg-red-400"
                  : verdict === "under"
                    ? "bg-amber-400"
                    : "bg-[#c5d1c8]"
            )}
          />
          Haqiqiy fakt · draft {verdict === "justified" ? "oqladi" : "oqlanmadi"}
          <ChevronRight size={9} className="ml-auto" />
        </span>
      </button>
      <p className="mt-1 text-right text-[9px] text-[#a0aba4]">
        {draftJustified(row) ? "1 / 1 oqladi" : "0 / 1 oqladi"}
      </p>
    </td>
  );
}

/** Kengaygan KPI ustuni: haqiqiy fakt, 5 usul va eng yaqin usul. */
export function OutcomeDetailCells({ row }: Omit<CellProps, "onExpand">) {
  const closest = closestMethod(row);
  return (
    <>
      <td className="numeric px-2 py-1.5 align-top text-[10px] font-semibold">
        {fmt(row?.actual)}
      </td>
      {OUTCOME_METHODS.map((method) => {
        const verdict = row?.verdicts[method.id] ?? "no_data";
        const deviation = row?.deviations[method.id] ?? null;
        return (
          <td key={method.id} className="px-2 py-1.5 align-top">
            <span className="numeric block text-[10px] font-semibold">
              {fmt(row?.predictions[method.id])}
            </span>
            <span
              className={cx("mt-0.5 flex items-center gap-1 text-[9px]", deviationTone(verdict))}
            >
              {verdict === "over" ? (
                <TrendingUp size={10} />
              ) : verdict === "under" ? (
                <TrendingDown size={10} />
              ) : null}
              {formatPercent(deviation)}
              <VerdictBadge verdict={verdict} short />
            </span>
          </td>
        );
      })}
      <td className="max-w-[160px] px-2 py-1.5 align-top text-[9px] leading-4">
        {closest ? (
          <>
            <span className="block font-semibold text-brand-700">{METHOD_SHORT[closest.id]}</span>
            <span className="text-[#8b9a90]">{formatPercent(closest.deviation)} og‘ish</span>
          </>
        ) : (
          <span className="text-[#b0bbb3]">Ma’lumot yo‘q</span>
        )}
      </td>
    </>
  );
}
