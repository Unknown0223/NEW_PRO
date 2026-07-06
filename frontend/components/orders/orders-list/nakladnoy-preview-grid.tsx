"use client";

import type { NakladnoyPreviewCell } from "@/lib/nakladnoy-preview";
import { cn } from "@/lib/utils";

type GridProps = {
  rows: NakladnoyPreviewCell[][];
  className?: string;
  tableClassName?: string;
};

export function NakladnoyPreviewGrid({ rows, className, tableClassName }: GridProps) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table
        className={cn(
          "border-collapse text-gray-900",
          tableClassName?.includes("nakladnoy-print-table")
            ? "w-full max-w-full"
            : "w-max max-w-none text-[11px]",
          tableClassName
        )}
      >
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                if (cell.skip) return null;
                const Tag = ri === 0 && cell.bold ? "th" : "td";
                const base =
                  Tag === "th"
                    ? "border border-gray-400 bg-[#d9d9d9] px-1.5 py-1 font-semibold"
                    : "border border-gray-400 px-1.5 py-0.5 align-middle";
                return (
                  <Tag
                    key={ci}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className={cn(
                      base,
                      cell.bold && Tag === "td" && "font-bold",
                      cell.align === "right" && "text-right tabular-nums",
                      cell.align === "center" && "text-center"
                    )}
                    style={{
                      ...(cell.bg ? { backgroundColor: cell.bg } : {}),
                      ...(cell.rowSpan && cell.rowSpan > 1
                        ? { verticalAlign: "middle" }
                        : {})
                    }}
                  >
                    {cell.v}
                  </Tag>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
