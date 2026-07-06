"use client";

import { DialogHeaderActions } from "@/components/ui/dialog-header-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  bulkExportTemplateKey,
  getVisibleTemplates,
  type BulkExportPrefsStore
} from "@/lib/bulk-export-template-prefs";
import { BULK_EXPORT_CATEGORIES, type BulkExportCategoryId } from "@/lib/bulk-export-templates";
import { cn } from "@/lib/utils";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefsStore: BulkExportPrefsStore;
  disabled?: boolean;
  pending?: boolean;
  errorMessage?: string | null;
  onDownload: (selectedKeys: Set<string>) => void | Promise<void>;
};

export function OrdersBulkDownloadModal({
  open,
  onOpenChange,
  prefsStore,
  disabled,
  pending,
  errorMessage,
  onDownload
}: Props) {
  const columns = useMemo(
    () =>
      BULK_EXPORT_CATEGORIES.map((cat) => ({
        ...cat,
        visible: getVisibleTemplates(cat.id, prefsStore)
      })),
    [prefsStore]
  );

  const allVisibleKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const col of columns) {
      for (const t of col.visible) {
        keys.add(bulkExportTemplateKey(t));
      }
    }
    return keys;
  }, [columns]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(allVisibleKeys));
  }, [open, allVisibleKeys]);

  const selectedCount = [...selected].filter((k) => allVisibleKeys.has(k)).length;
  const totalVisible = allVisibleKeys.size;
  const allSelected = selectedCount === totalVisible && totalVisible > 0;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const setCategoryAll = (categoryId: BulkExportCategoryId, on: boolean) => {
    const col = columns.find((c) => c.id === categoryId);
    if (!col) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of col.visible) {
        const key = bulkExportTemplateKey(t);
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  };

  const setAll = (on: boolean) => {
    setSelected(on ? new Set(allVisibleKeys) : new Set());
  };

  const handleDownload = () => {
    const filtered = new Set([...selected].filter((k) => allVisibleKeys.has(k)));
    void onDownload(filtered);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[10100] bg-black/40"
        showCloseButton={false}
        className={cn(
          "z-[10101] flex w-[min(98vw,76rem)] max-w-none flex-col gap-0 p-0",
          "max-h-[min(96vh,900px)] overflow-hidden sm:max-w-none"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <DialogHeader className="min-w-0 flex-1 space-y-0">
            <DialogTitle className="text-base">Загрузить одним файлом</DialogTitle>
          </DialogHeader>
          <DialogHeaderActions />
        </div>

        {totalVisible > 0 ? (
          <div className="border-b border-border px-5 py-2.5">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground",
                (disabled || pending) && "pointer-events-none opacity-50"
              )}
            >
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-teal-600"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate = selectedCount > 0 && !allSelected;
                  }
                }}
                disabled={disabled || pending}
                onChange={(e) => setAll(e.target.checked)}
              />
              Выбрать все
            </label>
          </div>
        ) : null}

        <div className="overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {columns.map((col) => {
              const colKeys = col.visible.map((t) => bulkExportTemplateKey(t));
              const colSelected = colKeys.filter((k) => selected.has(k)).length;
              const colAll = colKeys.length > 0 && colSelected === colKeys.length;

              return (
                <section
                  key={col.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-teal-300/90 bg-card dark:border-teal-800"
                >
                  <div className="flex flex-col gap-1.5 border-b border-teal-300/60 bg-teal-50 px-3 py-2.5 dark:border-teal-800 dark:bg-teal-950/40">
                    <span className="text-center text-xs font-semibold text-teal-800 dark:text-teal-300">
                      {col.title}
                    </span>
                    {col.visible.length > 0 ? (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center justify-center gap-1.5 text-xs text-teal-700 dark:text-teal-400",
                          (disabled || pending) && "pointer-events-none opacity-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 rounded border-input accent-teal-600"
                          checked={colAll}
                          ref={(el) => {
                            if (el) {
                              el.indeterminate =
                                colSelected > 0 && colSelected < colKeys.length;
                            }
                          }}
                          disabled={disabled || pending}
                          onChange={(e) => setCategoryAll(col.id, e.target.checked)}
                        />
                        <span>{colAll ? "Снять все" : "Выбрать все"}</span>
                      </label>
                    ) : null}
                  </div>

                  <div className="shrink-0">
                    {col.visible.length === 0 ? (
                      <p className="px-3 py-8 text-center text-xs text-muted-foreground">—</p>
                    ) : (
                      <ul>
                        {col.visible.map((tpl) => {
                          const key = bulkExportTemplateKey(tpl);
                          const checked = selected.has(key);
                          return (
                            <li key={key} className="border-b border-border/50 last:border-b-0">
                              <label
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-teal-50/80 dark:hover:bg-teal-950/30",
                                  checked && "bg-teal-50/50 dark:bg-teal-950/20",
                                  (disabled || pending) && "pointer-events-none opacity-50"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 shrink-0 rounded border-input accent-teal-600"
                                  checked={checked}
                                  disabled={disabled || pending}
                                  onChange={() => toggle(key)}
                                />
                                <Download
                                  className="size-3.5 shrink-0 text-muted-foreground"
                                  aria-hidden
                                />
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 text-sm leading-snug",
                                    checked
                                      ? "font-medium text-foreground"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {tpl.label}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {errorMessage ? (
          <p className="border-t border-destructive/30 bg-destructive/10 px-6 py-2.5 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        <DialogFooter
          showCloseButton={false}
          className="-mx-0 -mb-0 flex-row justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4"
        >
          <Button
            type="button"
            variant="outline"
            className="min-w-[7rem] px-5"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="min-w-[8rem] bg-teal-600 px-5 hover:bg-teal-700"
            disabled={disabled || pending || selectedCount === 0 || totalVisible === 0}
            onClick={handleDownload}
          >
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="mr-2 size-4" aria-hidden />
            )}
            {pending ? "Загрузка…" : "Скачать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
