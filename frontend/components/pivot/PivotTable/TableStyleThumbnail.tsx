"use client";

import type { PivotTableStyleDef, PivotTableStyleTokens } from "@/lib/pivot-table-styles";
import { cn } from "@/lib/utils";

type Props = {
  tokens: PivotTableStyleTokens;
  selected?: boolean;
  title?: string;
  onClick?: () => void;
  className?: string;
};

/** Mini Excel-like table thumbnail (header + banded rows + total). */
export function TableStyleThumbnail({ tokens, selected, title, onClick, className }: Props) {
  const rows = [0, 1, 2, 3, 4] as const;
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "box-border h-[42px] w-[62px] shrink-0 overflow-hidden rounded-[1px] border border-transparent p-0 transition-[outline,border-color]",
        "hover:outline hover:outline-1 hover:outline-[#f4b183]",
        selected && "outline outline-2 outline-[#ed7d31]",
        className
      )}
      style={{ background: tokens.bodyBg }}
    >
      <span className="flex h-full w-full flex-col" aria-hidden>
        <span
          className="flex h-[9px] shrink-0 items-center gap-[2px] px-[2px]"
          style={{ background: tokens.headerBg }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[3px] flex-1 rounded-[0.5px] opacity-80"
              style={{ background: tokens.headerFg === "#ffffff" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.28)" }}
            />
          ))}
        </span>
        {rows.map((i) => {
          const isTotal = i === 4;
          const banded = tokens.rowBand != null && i % 2 === 1;
          const bg = isTotal ? tokens.grandTotalBg : banded ? tokens.rowBand! : tokens.bodyBg;
          const line =
            isTotal || tokens.headerFg === "#ffffff"
              ? "rgba(0,0,0,0.35)"
              : "rgba(0,0,0,0.22)";
          return (
            <span
              key={i}
              className="flex min-h-0 flex-1 items-center gap-[2px] border-t px-[2px]"
              style={{ background: bg, borderColor: tokens.border }}
            >
              {[0, 1, 2].map((c) => (
                <span
                  key={c}
                  className="h-[2px] flex-1 rounded-[0.5px]"
                  style={{
                    background: line,
                    opacity: isTotal ? 0.9 : 0.65
                  }}
                />
              ))}
            </span>
          );
        })}
      </span>
    </button>
  );
}

export function TableStyleThumbnailFromDef({
  style,
  selected,
  onClick
}: {
  style: PivotTableStyleDef;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <TableStyleThumbnail
      tokens={style.tokens}
      selected={selected}
      title={style.label}
      onClick={onClick}
    />
  );
}
