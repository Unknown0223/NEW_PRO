"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { getUserFacingError } from "@/lib/error-utils";
import type { PayrollEntryRow } from "./payroll-api";
import { metricLabel } from "./formula-parts-editor";
import { formatMoney, formatPercent, kindLabel, monthLabel, remainingAmount } from "./payroll-utils";

export function EntryDetailDialog({
  row,
  month,
  readonly,
  onClose,
  saving,
  onSave
}: {
  row: PayrollEntryRow | null;
  month: string;
  readonly: boolean;
  onClose: () => void;
  saving: boolean;
  onSave: (body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [manualNet, setManualNet] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setManualNet(row?.net_amount != null ? String(row.net_amount) : "");
    setComment(row?.comment ?? "");
  }, [row]);

  if (!row) return null;

  const submit = async () => {
    setError(null);
    const n = Number(manualNet.replace(/\s/g, "").replace(",", "."));
    try {
      await onSave({ manual_net: Number.isFinite(n) ? n : null, comment: comment.trim() || null });
    } catch (e) {
      setError(getUserFacingError(e));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {row.fio} — {monthLabel(month)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Info label="Формула" value={row.formula_name ?? "yo‘q"} />
          <Info label="Вид" value={kindLabel(row.kind)} />
          <Info label="Дней" value={`${row.worked_days} / ${row.planned_days}`} />
          <Info label="KPI" value={formatPercent(row.achievement_percent, 1)} />
          <Info label="Оклад" value={formatMoney(row.base_amount)} />
          <Info label="Переменная" value={formatMoney(row.variable_amount)} />
          <Info label="Надбавки" value={formatMoney(row.allowance_amount)} />
          <Info label="Удержания" value={formatMoney(row.deduction_amount)} />
          <Info label="Начислено" value={formatMoney(row.gross_amount)} />
          <Info label="К выдаче" value={formatMoney(row.net_amount)} />
          <Info label="Выплачено" value={formatMoney(row.paid_amount)} />
          <Info label="Остаток" value={formatMoney(remainingAmount(row.net_amount, row.paid_amount))} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium">Hisob tarkibi</p>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border text-xs">
            {row.breakdown.map((b, i) => (
              <div key={`${b.code}-${i}`} className="flex items-center gap-2 border-b border-border/50 px-2 py-1 last:border-0">
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
                {b.note ? <span className="max-w-[45%] truncate text-[11px] text-muted-foreground">{b.note}</span> : null}
                <span className="tabular-nums">{b.amount === 0 ? "—" : formatMoney(b.amount)}</span>
              </div>
            ))}
            {row.breakdown.length === 0 ? (
              <p className="p-2 text-muted-foreground">Tarkib bo‘sh.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium">Ko‘rsatkichlar</p>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {Object.entries(row.metrics ?? {})
              .filter(([, v]) => Number(v) !== 0)
              .map(([k, v]) => (
                <span key={k} className="rounded bg-muted px-1.5 py-0.5">
                  {metricLabel(k)}: {formatGroupedInteger(Number(v))}
                </span>
              ))}
          </div>
        </div>

        {!readonly ? (
          <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Qo‘lda summa (сўм)</span>
              <Input inputMode="decimal" value={manualNet} onChange={(e) => setManualNet(e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">Izoh</span>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Yopish
          </Button>
          {!readonly ? (
            <Button type="button" disabled={saving} onClick={() => void submit()}>
              {saving ? "Сақланмоқда…" : "Сақлаш"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate font-medium tabular-nums">{value}</div>
    </div>
  );
}
