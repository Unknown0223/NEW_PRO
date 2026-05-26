"use client";

import {
  InvoiceTemplateSettingsPanel,
  NakladnoyTemplateSettingsPanel
} from "@/components/orders/orders-list/orders-bulk-export-template-settings-panels";
import {
  getBulkExportCategory,
  type BulkExportCategoryId
} from "@/lib/bulk-export-templates";
import {
  defaultTemplateSettings,
  getCategorySettingsMode,
  normalizeInvoiceTemplateSettings,
  normalizeNakladnoyTemplateSettings,
  type BulkExportTemplateSettings,
  type InvoiceTemplateFieldSettings,
  type NakladnoyTemplateSettings
} from "@/lib/bulk-export-template-settings";
import {
  type BulkExportCategoryPrefs,
  type BulkExportPrefsStore
} from "@/lib/bulk-export-template-prefs";
import { cn } from "@/lib/utils";
import { Settings, X } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  categoryId: BulkExportCategoryId | null;
  store: BulkExportPrefsStore;
  onOpenChange: (open: boolean) => void;
  onSave: (categoryId: BulkExportCategoryId, prefs: BulkExportCategoryPrefs) => void;
};

function cloneCategoryPrefs(prefs: BulkExportCategoryPrefs): BulkExportCategoryPrefs {
  return {
    order: [...prefs.order],
    enabled: { ...prefs.enabled },
    templateSettings: { ...prefs.templateSettings }
  };
}

export function OrdersBulkExportSettingsDialog({
  open,
  categoryId,
  store,
  onOpenChange,
  onSave
}: Props) {
  const [draft, setDraft] = useState<BulkExportCategoryPrefs | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const settingsMode = categoryId ? getCategorySettingsMode(categoryId) : "none";

  useEffect(() => {
    if (!open || !categoryId) {
      setDraft(null);
      setExpandedId(null);
      return;
    }
    setDraft(cloneCategoryPrefs(store[categoryId]));
    setExpandedId(null);
  }, [open, categoryId, store]);

  if (!open || !categoryId || !draft) return null;

  const category = getBulkExportCategory(categoryId);
  const byId = new Map(category.templates.map((t) => [t.id, t]));

  const toggleEnabled = (id: string) => {
    const nextOn = draft.enabled[id] === false;
    setDraft({
      ...draft,
      enabled: { ...draft.enabled, [id]: nextOn }
    });
    if (!nextOn && expandedId === id) setExpandedId(null);
  };

  const updateTemplateSettings = (id: string, next: BulkExportTemplateSettings) => {
    setDraft({
      ...draft,
      templateSettings: { ...draft.templateSettings, [id]: next }
    });
  };

  const getSettings = (id: string): BulkExportTemplateSettings | undefined => {
    const raw = draft.templateSettings[id];
    if (settingsMode === "nakladnoy") {
      return normalizeNakladnoyTemplateSettings(raw ?? defaultTemplateSettings("nakladnoy"));
    }
    if (settingsMode === "invoice") {
      return normalizeInvoiceTemplateSettings(raw ?? defaultTemplateSettings("invoice"));
    }
    return undefined;
  };

  return (
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-export-settings-title"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="bulk-export-settings-title" className="text-lg font-semibold text-foreground">
            {category.title}
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Отметьте отчёты для списка загрузки.
            {settingsMode !== "none"
              ? " Нажмите ⚙ у шаблона, чтобы настроить параметры экспорта."
              : null}
          </p>
          <ul className="space-y-2">
            {draft.order.map((id) => {
              const tpl = byId.get(id);
              if (!tpl) return null;
              const on = draft.enabled[id] !== false;
              const expanded = expandedId === id;
              const showGear = settingsMode !== "none" && on;

              return (
                <li
                  key={id}
                  className={cn(
                    "rounded-lg border border-border px-3 py-2.5",
                    on ? "bg-card" : "bg-muted/30 opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 rounded border-input accent-teal-600"
                      checked={on}
                      onChange={() => toggleEnabled(id)}
                      aria-label={tpl.label}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-sm",
                        on ? "font-medium text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {tpl.label}
                    </span>
                    {showGear ? (
                      <button
                        type="button"
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted",
                          expanded && "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400"
                        )}
                        title="Настройки шаблона"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId((cur) => (cur === id ? null : id))}
                      >
                        <Settings className="size-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>

                  {expanded && settingsMode === "nakladnoy" ? (
                    <NakladnoyTemplateSettingsPanel
                      templateId={id}
                      settings={getSettings(id) as NakladnoyTemplateSettings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}

                  {expanded && settingsMode === "invoice" ? (
                    <InvoiceTemplateSettingsPanel
                      settings={getSettings(id) as InvoiceTemplateFieldSettings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-border p-4">
          <button
            type="button"
            className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            onClick={() => {
              onSave(categoryId, draft);
              onOpenChange(false);
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
