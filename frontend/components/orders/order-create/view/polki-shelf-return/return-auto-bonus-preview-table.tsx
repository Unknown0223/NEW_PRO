"use client";

import { formatNumberGrouped } from "@/lib/format-numbers";
import type { PolkiAutoBonusPreviewLine } from "../../hooks/use-polki-auto-bonus";

export function ReturnAutoBonusPreviewTable({ lines }: { lines: PolkiAutoBonusPreviewLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Введите количество в таблице состава, затем нажмите «Пересчитать».
      </p>
    );
  }

  return (
    <div className="max-h-[280px] overflow-auto rounded-md border border-border/80">
      <table className="w-full min-w-[520px] border-collapse text-[11px]">
        <thead className="sticky top-0 bg-muted/80 text-left font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Товар</th>
            <th className="px-2 py-1.5 text-right">К возврату</th>
            <th className="px-2 py-1.5">Правило</th>
            <th className="px-2 py-1.5 text-right">Оплата</th>
            <th className="px-2 py-1.5 text-right">Бонус</th>
            <th className="px-2 py-1.5 text-right">Долг бонус</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.product_id} className="border-t border-border/60">
              <td className="px-2 py-1.5">
                <div className="font-medium text-foreground">{l.name}</div>
                <div className="font-mono text-muted-foreground">{l.sku}</div>
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatNumberGrouped(l.return_qty, { maxFractionDigits: 0 })}
              </td>
              <td className="px-2 py-1.5 text-muted-foreground">
                {l.rule_label ?? l.rule_name ?? "—"}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">{l.paid_qty}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{l.bonus_qty}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-amber-800 dark:text-amber-200">
                {l.bonus_debt_amount > 0
                  ? formatNumberGrouped(l.bonus_debt_amount, { maxFractionDigits: 2 })
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
