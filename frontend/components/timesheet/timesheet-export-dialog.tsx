"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TimesheetExportDialog({
  open,
  count,
  period,
  onExport,
  onClose
}: {
  open: boolean;
  count: number;
  period: string;
  onExport: (mode: "codes" | "labels") => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"codes" | "labels">("codes");
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="tabel-theme sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-emerald-600" /> Экспорт в Excel (.xlsx)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{count} сотр.</span> · {period} · по текущему фильтру
          </div>
          <div className="space-y-2">
            {(
              [
                ["codes", "Коды", "Символы как в табеле в ячейках (1 / 0.5 / 0, В / О / Б / К)"],
                ["labels", "Коды + примечания", "Те же символы + примечание: расшифровка буквы и/или комментарий"]
              ] as const
            ).map(([v, t, d]) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                  mode === v ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                )}
              >
                <input type="radio" checked={mode === v} onChange={() => setMode(v)} className="mt-0.5 accent-primary" />
                <div>
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="text-xs text-muted-foreground">{d}</div>
                </div>
              </label>
            ))}
          </div>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            В ячейки дней пишутся те же символы, что и в табеле: рабочие значения 1 / 0.5 / 0,
            спец-статусы — буквы В (выходной) / О (отпуск) / Б (больничный) / К (командировка).
            В режиме «Коды + примечания» примечание Excel добавляется только для буквенных
            статусов (расшифровка буквы) и/или при наличии комментария к ячейке; для шифры
            (0 / 0.5 / 1) без комментария примечание не ставится. Если есть и буква, и комментарий —
            они идут двумя отдельными строками. Наведите курсор на ячейку, чтобы увидеть примечание.
          </p>
        </div>
        <div className="-mx-4 -mb-4 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 p-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Отмена
          </Button>
          <Button size="sm" onClick={() => onExport(mode)}>
            <Download className="mr-1 size-3.5" /> Скачать
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
