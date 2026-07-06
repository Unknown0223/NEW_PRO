"use client";

import { OrdersBulkExportChip } from "@/components/orders/orders-list/orders-bulk-export-chip";
import { OrdersBulkExportSettingsDialog } from "@/components/orders/orders-list/orders-bulk-export-settings-dialog";
import type { BulkExportCategoryId, BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import { BULK_EXPORT_CATEGORIES } from "@/lib/bulk-export-templates";
import {
  loadBulkExportPrefsStore,
  saveBulkExportPrefsStore,
  type BulkExportCategoryPrefs,
  type BulkExportPrefsStore
} from "@/lib/bulk-export-template-prefs";
import { cn } from "@/lib/utils";
import { ArrowLeft, X } from "lucide-react";
import { useCallback, useState } from "react";

type Props = {
  disabled?: boolean;
  canBulkCatalog: boolean;
  separateSheets: boolean;
  onSeparateSheetsChange: (v: boolean) => void;
  onDownloadOneFile: () => void;
  onDownloadTemplate: (template: BulkExportTemplateDef) => void;
  onBack: () => void;
  onClose: () => void;
};

export function OrdersBulkUploadPanel({
  disabled,
  canBulkCatalog,
  separateSheets,
  onSeparateSheetsChange,
  onDownloadOneFile,
  onDownloadTemplate,
  onBack,
  onClose
}: Props) {
  const [prefsStore, setPrefsStore] = useState<BulkExportPrefsStore>(() => loadBulkExportPrefsStore());
  const [settingsCategory, setSettingsCategory] = useState<BulkExportCategoryId | null>(null);

  const saveCategoryPrefs = useCallback(
    (categoryId: BulkExportCategoryId, prefs: BulkExportCategoryPrefs) => {
      setPrefsStore((prev) => {
        const next = { ...prev, [categoryId]: prefs };
        saveBulkExportPrefsStore(next);
        return next;
      });
    },
    []
  );

  return (
    <>
      <div className="animate-expand w-full min-w-[min(100%,42rem)] max-w-[min(100vw-1rem,56rem)] rounded-xl border border-border bg-card p-3 shadow-2xl dark:border-border dark:bg-card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-teal-50 hover:text-teal-700 dark:text-muted-foreground dark:hover:bg-teal-950/40"
            title="Назад"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </button>

          <label
            className={cn(
              "flex flex-1 items-center gap-2 text-sm text-muted-foreground",
              !canBulkCatalog && "pointer-events-none opacity-50"
            )}
          >
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-teal-600"
              checked={separateSheets}
              disabled={disabled || !canBulkCatalog}
              onChange={(e) => onSeparateSheetsChange(e.target.checked)}
            />
            Отделить по листам
          </label>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={disabled || !canBulkCatalog}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              onClick={onDownloadOneFile}
            >
              Загрузить одним файлом
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-muted dark:hover:bg-muted"
              title="Закрыть"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {BULK_EXPORT_CATEGORIES.map((cat) => (
            <OrdersBulkExportChip
              key={cat.id}
              categoryId={cat.id}
              prefsStore={prefsStore}
              disabled={disabled}
              onOpenSettings={setSettingsCategory}
              onDownloadTemplate={onDownloadTemplate}
            />
          ))}
        </div>
      </div>

      <OrdersBulkExportSettingsDialog
        open={settingsCategory != null}
        categoryId={settingsCategory}
        store={prefsStore}
        onOpenChange={(open) => {
          if (!open) setSettingsCategory(null);
        }}
        onSave={saveCategoryPrefs}
      />
    </>
  );
}
