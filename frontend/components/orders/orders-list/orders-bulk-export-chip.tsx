"use client";

import { BulkToolbarDropdownPortal } from "@/components/orders/orders-list/bulk-toolbar-dropdown-portal";
import {
  getVisibleTemplates,
  type BulkExportPrefsStore
} from "@/lib/bulk-export-template-prefs";
import {
  getBulkExportCategory,
  type BulkExportCategoryId,
  type BulkExportTemplateDef
} from "@/lib/bulk-export-templates";
import { cn } from "@/lib/utils";
import { ChevronDown, Download, Settings } from "lucide-react";
import { useRef, useState } from "react";

export function OrdersBulkExportChip({
  categoryId,
  prefsStore,
  disabled,
  onOpenSettings,
  onDownloadTemplate
}: {
  categoryId: BulkExportCategoryId;
  prefsStore: BulkExportPrefsStore;
  disabled?: boolean;
  onOpenSettings: (categoryId: BulkExportCategoryId) => void;
  onDownloadTemplate: (template: BulkExportTemplateDef) => void;
}) {
  const category = getBulkExportCategory(categoryId);
  const [menuOpen, setMenuOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const visible = getVisibleTemplates(categoryId, prefsStore);

  return (
    <>
      <div
        ref={anchorRef}
        className={cn(
          "flex shrink-0 overflow-hidden rounded-lg border border-teal-300 bg-card",
          disabled && "opacity-50"
        )}
      >
        <button
          type="button"
          disabled={disabled}
          className="flex size-full min-h-[40px] w-10 shrink-0 items-center justify-center border-r border-teal-300/80 text-teal-600 transition-colors hover:bg-teal-50 disabled:pointer-events-none dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-950/40"
          title="Настройки отчётов"
          onClick={() => onOpenSettings(categoryId)}
        >
          <Settings className="size-4" aria-hidden />
        </button>

        <button
          type="button"
          disabled={disabled || visible.length === 0}
          className="flex min-w-[150px] items-center gap-2 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 disabled:pointer-events-none dark:text-teal-300 dark:hover:bg-teal-950/40"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="flex-1 text-left">{category.title}</span>
          <ChevronDown
            className={cn("size-3.5 shrink-0 transition-transform", menuOpen && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      <BulkToolbarDropdownPortal
        open={menuOpen}
        anchorRef={anchorRef}
        onClose={() => setMenuOpen(false)}
      >
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">Нет выбранных шаблонов</p>
        ) : (
          visible.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 border-b border-border/60 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
              onClick={() => {
                onDownloadTemplate(tpl);
                setMenuOpen(false);
              }}
            >
              <Download className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>{tpl.label}</span>
            </button>
          ))
        )}
      </BulkToolbarDropdownPortal>
    </>
  );
}
