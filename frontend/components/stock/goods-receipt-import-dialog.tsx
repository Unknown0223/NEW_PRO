"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ExcelDropTarget } from "@/components/ui/excel-file-drop-zone";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { pickFirstExcelFile } from "@/lib/excel-file-pick";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  warehouses: Array<{ id: number; name: string }>;
};

export function GoodsReceiptImportDialog({ open, onOpenChange, tenantSlug, warehouses }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function downloadTemplate() {
    setErrors([]);
    setSummary(null);
    const res = await api.get<Blob>(`/api/${tenantSlug}/stock/import-template?kind=postupleniya2`, {
      responseType: "blob"
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "postupleniya-kirim-shablon.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(file: File) {
    setBusy(true);
    setSummary(null);
    setErrors([]);
    setWarnings([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (warehouseId.trim()) fd.append("warehouse_id", warehouseId.trim());
      const { data } = await api.post<{ applied: number; errors: string[]; warnings?: string[] }>(
        `/api/${tenantSlug}/stock/import`,
        fd
      );
      setSummary(
        `Применено строк: ${data.applied}. Ошибок: ${data.errors.length}, предупреждений: ${data.warnings?.length ?? 0}.`
      );
      setErrors(data.errors);
      setWarnings(data.warnings ?? []);
      await qc.invalidateQueries({ queryKey: ["goods-receipts", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["stock", tenantSlug] });
    } catch (err) {
      setErrors([getUserFacingError(err, "Не удалось импортировать файл.")]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Импорт поступления из Excel</DialogTitle>
        </DialogHeader>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Шаблон «Поступление»: код товара, количество прихода, количество в блоке. Если в файле нет
          столбца «Склад», выберите склад ниже — все строки попадут на него.
        </p>
        <div className="space-y-2">
          <Label htmlFor="receipt-import-wh">Склад</Label>
          <select
            id="receipt-import-wh"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">— склад из файла —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={String(w.id)}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void downloadTemplate()}>
            <Download className="mr-1 size-3.5" />
            Скачать шаблон
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const f = pickFirstExcelFile(e.target.files);
              e.target.value = "";
              if (f) void importFile(f);
            }}
          />
          <ExcelDropTarget disabled={busy} onFile={(f) => void importFile(f)}>
            <Button type="button" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 size-3.5" />
              {busy ? "Импорт…" : "Выбрать файл"}
            </Button>
          </ExcelDropTarget>
        </div>
        {summary ? <p className="text-sm text-emerald-700">{summary}</p> : null}
        {errors.length > 0 ? (
          <ul className="max-h-40 list-disc space-y-1 overflow-auto pl-4 text-xs text-destructive">
            {errors.slice(0, 30).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {warnings.length > 0 ? (
          <ul className="max-h-28 list-disc space-y-1 overflow-auto pl-4 text-xs text-amber-700">
            {warnings.slice(0, 20).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
