"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { GroupedNumberInput } from "@/components/ui/grouped-number-input";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import {
  formatPriceDraftDisplay,
  isAllowedPriceInput,
  parsePriceDraft,
  sanitizePriceInput
} from "@/lib/price-matrix-draft";
import {
  importRowsToPatchItems,
  type PriceMatrixImportPreviewRow
} from "@/lib/price-matrix-import-parse";
import { cn } from "@/lib/utils";
import { Loader2, Pencil } from "lucide-react";
import { isAxiosError } from "axios";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  categoryId?: number;
  categoryIds?: number[];
  priceType: string;
  currency: string;
  initialRows: PriceMatrixImportPreviewRow[];
  onSaved: () => void;
};

function statusLabel(status: PriceMatrixImportPreviewRow["status"]): string {
  if (status === "ok") return "OK";
  if (status === "warning") return "O‘tkaziladi";
  return "Xato";
}

function displayPrice(raw: string): string {
  const t = raw.trim();
  if (!t) return "—";
  const parsed = parsePriceDraft(t);
  if (parsed.ok) return formatPriceDraftDisplay(parsed.value);
  return t;
}

function revalidateRow(row: PriceMatrixImportPreviewRow): PriceMatrixImportPreviewRow {
  if (row.product_id == null) return row;
  const priceDisplay = sanitizePriceInput(row.priceDisplay);
  if (priceDisplay.trim() === "") {
    return { ...row, priceDisplay: "", status: "warning", message: "Narx bo‘sh — o‘tkazib yuboriladi" };
  }
  const parsed = parsePriceDraft(priceDisplay);
  if (!parsed.ok) {
    return {
      ...row,
      priceDisplay,
      status: "error",
      message: parsed.reason === "too_large" ? "Narx juda katta" : "Narx noto‘g‘ri"
    };
  }
  return { ...row, priceDisplay: String(parsed.value), status: "ok", message: "" };
}

export function PriceMatrixImportPreviewDialog({
  open,
  onOpenChange,
  tenantSlug,
  categoryId,
  categoryIds,
  priceType,
  currency,
  initialRows,
  onSaved
}: Props) {
  const [rows, setRows] = useState<PriceMatrixImportPreviewRow[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRows(initialRows.map((r) => ({ ...r })));
      setIsEditing(false);
      setSaving(false);
      setError(null);
    }
  }, [open, initialRows]);

  const okCount = rows.filter((r) => r.status === "ok").length;
  const warnCount = rows.filter((r) => r.status === "warning").length;
  const errCount = rows.filter((r) => r.status === "error").length;
  const canConfirm = okCount > 0 && !saving;

  async function handleConfirm() {
    const items = importRowsToPatchItems(rows);
    if (items.length === 0) {
      setError("Saqlash uchun kamida bitta to‘g‘ri qator kerak.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/${tenantSlug}/products/prices/matrix`, {
        price_type: priceType,
        currency,
        ...(categoryIds && categoryIds.length > 0
          ? { category_ids: categoryIds }
          : categoryId != null
            ? { category_id: categoryId }
            : {}),
        items
      });
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      setError(getUserFacingError(e, isAxiosError(e) ? "Saqlashda xato." : "Saqlashda xato."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,56rem)]">
        <DialogHeader className="shrink-0 space-y-2 border-b px-6 py-4">
          <DialogTitle className="text-lg">Excel import — ko‘rib chiqish</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            <span className="font-medium text-foreground">{priceType}</span>
            {categoryIds && categoryIds.length > 0
              ? ` · ${categoryIds.length} ta kategoriya`
              : categoryId != null
                ? ` · kategoriya ID ${categoryId}`
                : ""}
            . Tasdiqlashdan keyin narxlar tizimga yoziladi.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              OK: {okCount}
            </span>
            <span className="inline-flex rounded-md bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              O‘tkaziladi: {warnCount}
            </span>
            <span className="inline-flex rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-950/50 dark:text-red-300">
              Xato: {errCount}
            </span>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="app-table-thead sticky top-0 z-[1] text-left">
                <tr>
                  <th className="w-12 px-3 py-2.5 font-medium">№</th>
                  <th className="min-w-[7rem] px-3 py-2.5 font-medium">SKU</th>
                  <th className="min-w-[14rem] px-3 py-2.5 font-medium">Название</th>
                  <th className="min-w-[9rem] px-3 py-2.5 text-right font-medium">Сумма ({currency})</th>
                  <th className="min-w-[7rem] px-3 py-2.5 font-medium">Holat</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Faylda ma’lumot topilmadi.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={`${r.rowNum}-${r.sku}`} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rowNum}</td>
                      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{r.sku || "—"}</td>
                      <td className="px-3 py-2" title={r.name}>
                        <span className="line-clamp-2">{r.name || "—"}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditing && r.product_id != null && r.status !== "error" ? (
                          <GroupedNumberInput
                            className="ml-auto h-9 w-full max-w-[11rem] font-mono text-sm tabular-nums"
                            value={r.priceDisplay}
                            maxLength={16}
                            maxFractionDigits={2}
                            onValueChange={(v) => {
                              setRows((prev) =>
                                prev.map((x) =>
                                  x.rowNum === r.rowNum && x.sku === r.sku
                                    ? revalidateRow({ ...x, priceDisplay: v })
                                    : x
                                )
                              );
                            }}
                          />
                        ) : (
                          <span className="font-mono text-sm font-medium tabular-nums">
                            {displayPrice(r.priceDisplay)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                            r.status === "ok" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                            r.status === "warning" &&
                              "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                            r.status === "error" && "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                          )}
                        >
                          {statusLabel(r.status)}
                        </span>
                        {r.message ? (
                          <p className="mt-1 text-xs text-muted-foreground">{r.message}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error ? <p className="shrink-0 px-6 text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="shrink-0 flex-col gap-3 border-t bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            className="h-10 border-red-300 bg-red-50 text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60"
            onClick={() => onOpenChange(false)}
          >
            Bekor qilish
          </Button>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              disabled={saving || rows.length === 0}
              className="h-10 bg-amber-500 text-amber-950 hover:bg-amber-400 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
              onClick={() => setIsEditing((v) => !v)}
            >
              <Pencil className="mr-1.5 size-4" aria-hidden />
              {isEditing ? "Ko‘rinish" : "Tahrirlash"}
            </Button>
            <Button
              type="button"
              disabled={!canConfirm}
              className="h-10 min-w-[9rem] bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              onClick={() => void handleConfirm()}
            >
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              Tasdiqlash
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
