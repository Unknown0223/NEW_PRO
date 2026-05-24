"use client";

import { formatNumberGrouped } from "@/lib/format-numbers";
import type { OrderCreateVm } from "../../hooks/use-order-create";

/** Erkin polki: ogohlantirishlar va jami «Долг бонус» (toggle/apply yo‘q). */
export function ReturnAutoBonusWarningsStrip({ vm }: { vm: OrderCreateVm }) {
  const { polkiAutoBonusPreviewQ, polkiAutoBonusDebtAmount, polkiAutoBonusPreviewPending } = vm;

  const preview = polkiAutoBonusPreviewQ.data;
  const err = polkiAutoBonusPreviewQ.isError;

  if (!preview && !err && !polkiAutoBonusPreviewPending) return null;

  return (
    <div className="space-y-2 rounded-lg border border-teal-800/15 bg-teal-50/40 px-3 py-2 dark:bg-teal-950/20">
      <p className="text-[11px] font-semibold text-slate-800">Авто-распределение бонуса</p>
      <p className="text-[10px] leading-snug text-muted-foreground">
        По активным qty-правилам и остаткам доставленных продаж. Детали — в колонке «Бонус /
        баланс» таблицы.
      </p>

      {polkiAutoBonusPreviewPending ? (
        <p className="text-[11px] text-muted-foreground">Пересчёт…</p>
      ) : null}

      {err ? (
        <p className="text-[11px] text-destructive">
          Не удалось рассчитать бонус. Проверьте сеть и количества в таблице.
        </p>
      ) : null}

      {preview?.warnings.length ? (
        <ul className="list-inside list-disc text-[11px] text-amber-900 dark:text-amber-100">
          {preview.warnings.slice(0, 4).map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      {polkiAutoBonusDebtAmount > 0 ? (
        <p className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
          Итого долг бонус по документу:{" "}
          <span className="tabular-nums">
            {formatNumberGrouped(polkiAutoBonusDebtAmount, { maxFractionDigits: 0 })}
          </span>{" "}
          сум — при оформлении запишется в «Балансы клиентов» (тип «Долг бонус»)
        </p>
      ) : null}
    </div>
  );
}
