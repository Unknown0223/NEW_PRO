"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { downloadXlsx, readXlsxRows } from "@/lib/payroll/payroll-xlsx";
import { money, payrollErrorText } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";

export type ImportPreviewRow = { row: number; code: string; fio?: string | null; amount?: number | null; status: string; note?: string };

type Props<T> = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  hint: string;
  templateHeader: string[];
  templateFile: string;
  /** Excel qatorlari → API qatorlari (xato bo'lsa matn). */
  mapRows: (rows: Array<Record<string, unknown>>) => T[] | string;
  preview: (rows: T[], apply: boolean) => Promise<{ rows: ImportPreviewRow[]; applied?: number }>;
  statusLabels: Record<string, string>;
  okStatuses?: string[];
  onApplied: (applied: number) => void;
};

export function PayrollExcelImportDialog<T>(p: Props<T>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [preview, setPreview] = useState<ImportPreviewRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const okSet = new Set(p.okStatuses ?? ["ok"]);
  const okCount = preview?.filter((r) => okSet.has(r.status)).length ?? 0;

  const reset = () => {
    setRows(null);
    setPreview(null);
    setError(null);
  };

  const onFile = async (file: File) => {
    reset();
    setBusy(true);
    try {
      const mapped = p.mapRows(await readXlsxRows(file));
      if (typeof mapped === "string") {
        setError(mapped);
        return;
      }
      setRows(mapped);
      setPreview((await p.preview(mapped, false)).rows);
    } catch (e) {
      setError(payrollErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!rows) return;
    setBusy(true);
    try {
      const res = await p.preview(rows, true);
      p.onApplied(res.applied ?? res.rows.filter((r) => okSet.has(r.status) || r.status === "created").length);
      reset();
      p.onOpenChange(false);
    } catch (e) {
      setError(payrollErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={p.open}
      onOpenChange={(o) => {
        if (!o) reset();
        p.onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{p.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{p.hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void downloadXlsx(p.templateFile, p.templateHeader, [])}>
              <Download className="mr-1 size-4" /> Шаблон
            </Button>
            <span className="text-xs text-muted-foreground">Колонки: {p.templateHeader.join(", ")}</span>
          </div>
          <ExcelFileDropZone onFile={(f) => void onFile(f)} disabled={busy} />
          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {preview ? (
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs">
                  <tr>
                    <th className="px-2 py-1.5">#</th>
                    <th className="px-2 py-1.5">Код</th>
                    <th className="px-2 py-1.5">Сотрудник</th>
                    <th className="px-2 py-1.5 text-right">Сумма</th>
                    <th className="px-2 py-1.5">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.row} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">{r.row}</td>
                      <td className="px-2 py-1">{r.code}</td>
                      <td className="px-2 py-1">{r.fio ?? "—"}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{money(r.amount ?? null)}</td>
                      <td className={cn("px-2 py-1", okSet.has(r.status) ? "text-emerald-700" : "text-red-700")}>
                        {p.statusLabels[r.status] ?? r.status}
                        {r.note ? <span className="ml-1 text-xs text-muted-foreground">{r.note}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{preview ? `Готово к загрузке: ${okCount} из ${preview.length}` : ""}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => p.onOpenChange(false)}>Отмена</Button>
              <Button size="sm" disabled={!preview || okCount === 0 || busy} onClick={() => void apply()}>
                Загрузить
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
