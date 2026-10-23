"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

type ImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  warnings?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  onImported?: () => void;
};

export function OpeningBalanceImportDialog({
  open,
  onOpenChange,
  tenantSlug,
  onImported
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const downloadTemplate = async () => {
    setMsg(null);
    setErrors([]);
    setWarnings([]);
    try {
      const res = await api.get(`/api/${tenantSlug}/opening-balances/import-template`, {
        responseType: "blob"
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "nachalnye-balansy-shablon.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Шаблон скачан. Сумма > 0 — предоплата, < 0 — задолженность.");
    } catch (e) {
      setMsg(getUserFacingError(e, "Не удалось скачать шаблон"));
    }
  };

  const runImport = async (file: File) => {
    setBusy(true);
    setMsg(null);
    setErrors([]);
    setWarnings([]);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post<{
        data: ImportResult & { warnings?: string[] };
      }>(`/api/${tenantSlug}/opening-balances/import.xlsx`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const r = data.data;
      setErrors(r.errors.slice(0, 40));
      setWarnings((r.warnings ?? []).slice(0, 40));
      const warnN = r.warnings?.length ?? 0;
      if (r.errors.length > 0) {
        setMsg(
          `Создано ${r.created}. Ошибок: ${r.errors.length}${
            warnN ? `, предупреждений: ${warnN}` : ""
          }${r.skipped ? `, пропущено: ${r.skipped}` : ""}.`
        );
      } else {
        setMsg(
          `Импорт завершён: создано ${r.created}${
            r.skipped ? `, пропущено неполных: ${r.skipped}` : ""
          }${warnN ? `. Предупреждений: ${warnN}` : ""}.`
        );
      }
      if (r.created > 0) onImported?.();
    } catch (e) {
      setMsg(getUserFacingError(e, "Ошибка импорта — проверьте шаблон Excel"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:max-w-lg" showCloseButton>
        <DialogHeader className="space-y-1 border-b border-border px-5 pb-3 pt-4 pr-14 text-left">
          <DialogTitle className="text-base font-semibold">Импорт из Excel</DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Колонки: <strong>ID клиента</strong> (числовой DB id <em>или</em> код вроде{" "}
            <code className="text-[0.7rem]">a0_126</code>), <strong>Область</strong>,{" "}
            <strong>Код агента</strong>, <strong>Сумма</strong>. Сумма &gt; 0 — предоплата, &lt; 0 —
            задолженность, 0 — пропуск. Код агента из Excel используется для баланса, если найден в
            системе; иначе — агент из карточки. Без агента и там и там — отказ. Дата = момент импорта.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          {msg ? (
            <p className="text-sm text-foreground" role="status">
              {msg}
            </p>
          ) : null}
          {errors.length > 0 ? (
            <ul className="max-h-40 list-disc space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 px-4 py-2 text-xs text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="max-h-32 list-disc space-y-1 overflow-y-auto rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
              {warnings.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={() => void downloadTemplate()}
            >
              <Download className="h-4 w-4" />
              Скачать шаблон
            </Button>
            <Button
              type="button"
              className="gap-1.5 bg-teal-600 text-white hover:bg-teal-700"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              {busy ? "Импорт…" : "Выбрать файл"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runImport(f);
              }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
