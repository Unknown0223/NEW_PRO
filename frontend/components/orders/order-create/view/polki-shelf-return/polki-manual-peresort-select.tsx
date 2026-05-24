"use client";

import { cn } from "@/lib/utils";
import { peresortSelectOptions } from "../../polki-bonus-balance.logic";
import type { PolkiPairRowModel } from "../../types";

export function PolkiManualPeresortSelect({
  row,
  pairKey,
  effBonus,
  value,
  disabled,
  optionsByProductId,
  onChange
}: {
  row: PolkiPairRowModel;
  pairKey: string;
  effBonus: number;
  value: number | undefined;
  disabled: boolean;
  optionsByProductId?: Map<number, Array<{ id: number; name: string }>>;
  onChange: (pairKey: string, productId: number) => void;
}) {
  if (effBonus <= 0) return null;

  const opts = peresortSelectOptions(
    row.product_id,
    row.name,
    optionsByProductId?.get(row.product_id)
  );
  if (opts.length <= 1) return null;

  return (
    <label className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
      <span className="shrink-0 whitespace-nowrap">Пересорт на склад:</span>
      <select
        className={cn(
          "h-7 min-w-0 max-w-[11rem] flex-1 truncate rounded-md border border-input bg-background px-1.5 text-[11px]",
          disabled && "cursor-not-allowed opacity-60"
        )}
        value={String(value ?? row.product_id)}
        disabled={disabled}
        onChange={(e) => {
          const pid = Number.parseInt(e.target.value, 10);
          if (Number.isFinite(pid)) onChange(pairKey, pid);
        }}
      >
        {opts.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
