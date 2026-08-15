"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildXlsxBlobFromPreview,
  previewHasBlockingErrors,
  updatePreviewCell
} from "@/lib/initial-setup/preview-xlsx";
import { runImportStep } from "@/lib/initial-setup/import-async";
import type { InitialSetupPreviewState, InitialSetupStep } from "@/lib/initial-setup/types";
import { getStepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  step: InitialSetupStep;
  preview: InitialSetupPreviewState;
  onApplied: (message: string) => void;
};

export function InitialSetupPreviewDialog({
  open,
  onOpenChange,
  tenantSlug,
  step,
  preview: initialPreview,
  onApplied
}: Props) {
  const [preview, setPreview] = useState(initialPreview);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) setPreview(initialPreview);
  }, [open, initialPreview]);

  const hasErrors = useMemo(() => previewHasBlockingErrors(preview), [preview]);
  const errorCount = preview.rows.filter((r) => r.errors.length).length;
  const okCount = preview.rows.length - errorCount;

  const tableConfig = getStepTableConfig(step.id);

  async function apply() {
    if (!step.importApi || hasErrors) return;
    setBusy(true);
    setMsg(null);
    try {
      const blob = buildXlsxBlobFromPreview(preview, tableConfig);
      const message = await runImportStep(
        tenantSlug,
        step.importApi.importPath,
        step.importApi.importAsyncPath,
        blob,
        preview.fileName
      );
      onApplied(message);
      onOpenChange(false);
    } catch (e) {
      setMsg(getUserFacingError(e, "Import xatosi"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Ko‘rib chiqish — {step.title}</DialogTitle>
          <DialogDescription>
            {preview.rows.length} qator. Xatolarni jadvalda tuzating, keyin «Qo‘llash».
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="size-3.5" /> OK: {okCount}
            </span>
            {errorCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <AlertCircle className="size-3.5" /> Xato: {errorCount}
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border-b px-2 py-2 text-left font-semibold">#</th>
                  {preview.columns.map((col) => (
                    <th key={col} className="border-b px-2 py-2 text-left font-semibold">
                      {col}
                    </th>
                  ))}
                  <th className="border-b px-2 py-2 text-left font-semibold">Holat</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowIndex}
                    className={cn(
                      row.errors.length ? "bg-destructive/5" : row.warnings.length ? "bg-amber-50/80" : ""
                    )}
                  >
                    <td className="border-b px-2 py-1 tabular-nums text-muted-foreground">{row.rowIndex}</td>
                    {preview.columns.map((col) => (
                      <td key={col} className="border-b px-1 py-1">
                        <Input
                          className="h-8 min-w-[6rem] text-xs"
                          value={row.cells[col.toLowerCase().replace(/\s+/g, "_")] ?? row.cells[col] ?? ""}
                          onChange={(e) =>
                            setPreview((p) =>
                              updatePreviewCell(p, row.rowIndex, col, e.target.value, tableConfig)
                            )
                          }
                        />
                      </td>
                    ))}
                    <td className="border-b px-2 py-1 text-[11px] text-muted-foreground">
                      {row.errors.join("; ") || row.warnings.join("; ") || "OK"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {msg ? <p className="px-6 text-sm text-destructive">{msg}</p> : null}

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Bekor
          </Button>
          <Button type="button" onClick={() => void apply()} disabled={busy || hasErrors || !preview.rows.length}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Qo‘llash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
