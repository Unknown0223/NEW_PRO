"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePickerPopover, formatRuDateButton } from "@/components/ui/date-picker-popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CalendarDays, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { priceTypeDisplayLabel } from "@/lib/price-type-label";

export type OldPricesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceTypes: string[];
  priceTypeLabels: Map<string, string>;
  draftAsOf: string;
  draftPriceType: string;
  onDraftAsOfChange: (ymd: string) => void;
  onDraftPriceTypeChange: (key: string) => void;
  applying: boolean;
  error: string | null;
  onConfirm: () => void;
  onRetry: () => void;
};

function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function OldPricesModal({
  open,
  onOpenChange,
  priceTypes,
  priceTypeLabels,
  draftAsOf,
  draftPriceType,
  onDraftAsOfChange,
  onDraftPriceTypeChange,
  applying,
  error,
  onConfirm,
  onRetry
}: OldPricesModalProps) {
  const dateAnchorRef = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const types = priceTypes.length > 0 ? priceTypes : ["retail"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        overlayClassName="bg-black/40"
        showCloseButton={!applying}
      >
        <DialogHeader>
          <DialogTitle>Старые цены</DialogTitle>
          <DialogDescription>
            Выберите дату и тип цены. После подтверждения цены в каталоге ниже обновятся, в
            комментарий будет добавлена запись об изменении.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Дата цен</Label>
            <button
              ref={dateAnchorRef}
              type="button"
              disabled={applying}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-10 w-full justify-start gap-2 font-normal",
                dateOpen && "border-primary/60 bg-primary/5"
              )}
              aria-expanded={dateOpen}
              aria-haspopup="dialog"
              onClick={() => setDateOpen((o) => !o)}
            >
              <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">
                {formatRuDateButton(draftAsOf) || "дд.мм.гггг"}
              </span>
            </button>
            <DatePickerPopover
              open={dateOpen}
              onOpenChange={setDateOpen}
              anchorRef={dateAnchorRef}
              value={draftAsOf}
              onChange={(ymd) => {
                onDraftAsOfChange(ymd || localYmd());
                setDateOpen(false);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Тип цены</Label>
            <div
              className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/10 p-2"
              role="radiogroup"
              aria-label="Тип цены для старых цен"
            >
              {types.map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm hover:bg-muted/60",
                    draftPriceType === t && "border-primary/40 bg-primary/5"
                  )}
                >
                  <input
                    type="radio"
                    name="old-prices-type"
                    className="size-4 border-input"
                    checked={draftPriceType === t}
                    onChange={() => onDraftPriceTypeChange(t)}
                    disabled={applying}
                  />
                  <span className="font-medium capitalize">
                    {priceTypeDisplayLabel(t, priceTypeLabels)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error ? (
            <div
              className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start gap-1.5"
                disabled={applying}
                onClick={onRetry}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", applying && "animate-spin")} />
                Обновить и повторить
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={applying}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button type="button" disabled={applying || !draftAsOf.trim()} onClick={onConfirm}>
            {applying ? "Загрузка…" : "Подтвердить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function buildOldPricesAutoComment(
  asOfYmd: string,
  priceTypeKey: string,
  priceTypeLabels: Map<string, string>
): string {
  const label = priceTypeDisplayLabel(priceTypeKey, priceTypeLabels);
  const ru = formatRuDateButton(asOfYmd) || asOfYmd;
  return `Старые цены: ${ru}, тип «${label}»`;
}

export function mergeOldPricesComment(existing: string, autoLine: string): string {
  const trimmed = existing.trim();
  const marker = "Старые цены:";
  if (!trimmed) return autoLine;
  const lines = trimmed.split(/\r?\n/).filter((l) => !l.trim().startsWith(marker));
  return [...lines, autoLine].join("\n").trim();
}
