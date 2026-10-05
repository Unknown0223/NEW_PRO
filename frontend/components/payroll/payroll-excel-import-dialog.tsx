"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";
import { downloadXlsx, readXlsxRows } from "@/lib/payroll/payroll-xlsx";
import { money, payrollErrorText } from "@/lib/payroll/payroll-api";
import { cn } from "@/lib/utils";
import { PAYROLL_BTN, PayrollModal, PayrollModalActions, PayrollModalNote } from "@/components/payroll/kit/payroll-kit-modal";
import { PAYROLL_TABLE, PAYROLL_TH, PAYROLL_THEAD, PAYROLL_TR } from "@/components/payroll/kit/payroll-kit-table";

const CELL = "px-4 py-2";

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
    <PayrollModal
      open={p.open}
      onClose={() => {
        reset();
        p.onOpenChange(false);
      }}
      title={p.title}
      width="sm:max-w-[760px]"
    >
      <div className="space-y-3.5">
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{p.hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={PAYROLL_BTN.secondary} onClick={() => void downloadXlsx(p.templateFile, p.templateHeader, [])}>
            <Download className="text-emerald-600" /> Шаблон
          </button>
          <span className="text-[12px] text-muted-foreground">Колонки: {p.templateHeader.join(", ")}</span>
        </div>
        <ExcelFileDropZone onFile={(f) => void onFile(f)} disabled={busy} />
        {error ? <PayrollModalNote tone="error">{error}</PayrollModalNote> : null}
        {preview ? (
          <div className="max-h-80 overflow-auto rounded-lg border border-[var(--pr-border)]">
            <table className={PAYROLL_TABLE}>
              <thead className={cn(PAYROLL_THEAD, "sticky top-0 z-10")}>
                <tr>
                  <th className={PAYROLL_TH}>#</th>
                  <th className={PAYROLL_TH}>Код</th>
                  <th className={PAYROLL_TH}>Сотрудник</th>
                  <th className={cn(PAYROLL_TH, "text-right")}>Сумма</th>
                  <th className={PAYROLL_TH}>Статус</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={r.row} className={PAYROLL_TR}>
                    <td className={cn(CELL, "text-muted-foreground")}>{r.row}</td>
                    <td className={CELL}>{r.code}</td>
                    <td className={CELL}>{r.fio ?? "—"}</td>
                    <td className={cn(CELL, "text-right tabular-nums")}>{money(r.amount ?? null)}</td>
                    <td className={cn(CELL, okSet.has(r.status) ? "text-emerald-700" : "text-rose-700")}>
                      {p.statusLabels[r.status] ?? r.status}
                      {r.note ? <span className="ml-1 text-[12px] text-muted-foreground">{r.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {preview ? (
          <p className="text-[12.5px] text-muted-foreground">
            Готово к загрузке: <b className="text-[var(--pr-brand-600)]">{okCount}</b> из {preview.length}
          </p>
        ) : null}
        <PayrollModalActions onCancel={() => p.onOpenChange(false)} onSubmit={() => void apply()} submitLabel="Загрузить" busy={busy} disabled={!preview || okCount === 0} />
      </div>
    </PayrollModal>
  );
}
