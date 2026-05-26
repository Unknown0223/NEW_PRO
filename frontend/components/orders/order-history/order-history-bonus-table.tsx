"use client";

import type { OrderHistoryBonusSection } from "./build-order-history-data";
import { cn } from "@/lib/utils";

export function OrderHistoryBonusTable({ section }: { section: OrderHistoryBonusSection }) {
  const { autoBonusApplied, bonusQty, bonusSum, hasBonusLines, entries } = section;

  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-foreground">История бонусов</h3>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <span
          className={cn(
            "rounded-md px-2.5 py-1 font-medium",
            autoBonusApplied
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              : "bg-muted text-muted-foreground"
          )}
        >
          Автоматический бонус: {autoBonusApplied ? "Да" : "Нет"}
        </span>
        <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
          Кол-во бонусов: {bonusQty} шт
        </span>
        <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
          Сумма бонусов: {bonusSum}
        </span>
        <span
          className={cn(
            "rounded-md px-2.5 py-1 font-medium",
            hasBonusLines
              ? "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
              : "bg-muted text-muted-foreground"
          )}
        >
          Бонусные позиции: {hasBonusLines ? "Есть" : "Нет"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Дата
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Название бонуса
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Продукт
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Кол-во
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                Действие
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">
                Исполнитель
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((bonus) => (
              <tr
                key={bonus.id}
                className={cn(
                  "border-b border-border/60 last:border-b-0",
                  bonus.action === "Не начислен" && "bg-muted/25"
                )}
              >
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {bonus.date}
                </td>
                <td className="px-4 py-3 text-xs text-foreground">{bonus.bonusName}</td>
                <td className="px-4 py-3 text-xs text-foreground">{bonus.product}</td>
                <td className="px-4 py-3 text-xs text-foreground">
                  {bonus.quantity == null ? "—" : bonus.quantity}
                </td>
                <td className="px-4 py-3 text-xs">
                  <BonusActionLabel action={bonus.action} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground">
                  {bonus.user}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BonusActionLabel({ action }: { action: OrderHistoryBonusSection["entries"][0]["action"] }) {
  const styles: Record<string, string> = {
    Создано: "text-emerald-700 dark:text-emerald-300",
    Изменено: "text-amber-700 dark:text-amber-300",
    Удалено: "text-destructive",
    "Не начислен": "text-muted-foreground"
  };
  return <span className={cn("font-medium", styles[action] ?? "")}>{action}</span>;
}
