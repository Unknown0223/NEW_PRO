"use client";

import {
  InvoiceTemplateSettingsPanel,
  NakladnoyTemplateSettingsPanel,
  Warehouse112SettingsPanel,
  Warehouse410SettingsPanel,
  Warehouse600SettingsPanel
} from "@/components/orders/orders-list/orders-bulk-export-template-settings-panels";
import {
  getBulkExportCategory,
  type BulkExportCategoryId
} from "@/lib/bulk-export-templates";
import {
  defaultTemplateSettings,
  getTemplateSettingsMode,
  normalizeTemplateSettings,
  type BulkExportSettingsMode,
  type BulkExportTemplateSettings,
  type InvoiceTemplateFieldSettings,
  type NakladnoyTemplateSettings,
  type Warehouse112Settings,
  type Warehouse410Settings,
  type Warehouse600Settings
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

  const enabledCount = draft.order.filter((id) => draft.enabled[id] !== false).length;
  const allEnabled = draft.order.length > 0 && enabledCount === draft.order.length;

  const setAllEnabled = (on: boolean) => {
    const enabled: Record<string, boolean> = { ...draft.enabled };
    for (const id of draft.order) {
      enabled[id] = on;
    }
    setDraft({ ...draft, enabled });
    if (!on) setExpandedId(null);
  };

  const updateTemplateSettings = (id: string, next: BulkExportTemplateSettings) => {
    setDraft({
      ...draft,
      templateSettings: { ...draft.templateSettings, [id]: next }
    });
  };

  const getSettingsMode = (id: string): BulkExportSettingsMode =>
    categoryId ? getTemplateSettingsMode(categoryId, id) : "none";

  const getSettings = (id: string): BulkExportTemplateSettings | undefined => {
    const mode = getSettingsMode(id);
    return normalizeTemplateSettings(mode, draft.templateSettings[id] ?? defaultTemplateSettings(mode));
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
        className="flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-export-settings-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h2
            id="bulk-export-settings-title"
            className="min-w-0 flex-1 text-lg font-semibold text-foreground"
          >
            {category.title}
          </h2>
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-muted"
            onClick={() => onOpenChange(false)}
            aria-label="Закрыть"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border-input accent-teal-600"
              checked={allEnabled}
              ref={(el) => {
                if (el) {
                  el.indeterminate = enabledCount > 0 && !allEnabled;
                }
              }}
              onChange={(e) => setAllEnabled(e.target.checked)}
            />
            {allEnabled ? "Снять все" : "Выбрать все"}
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <ul className="space-y-2">
            {draft.order.map((id) => {
              const tpl = byId.get(id);
              if (!tpl) return null;
              const on = draft.enabled[id] !== false;
              const expanded = expandedId === id;
              const tplMode = getSettingsMode(id);
              const showGear = tplMode !== "none" && on;

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

                  {expanded && tplMode === "nakladnoy" ? (
                    <NakladnoyTemplateSettingsPanel
                      templateId={id}
                      settings={getSettings(id) as NakladnoyTemplateSettings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}

                  {expanded && tplMode === "invoice" ? (
                    <InvoiceTemplateSettingsPanel
                      settings={getSettings(id) as InvoiceTemplateFieldSettings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}

                  {expanded && tplMode === "warehouse-112" ? (
                    <Warehouse112SettingsPanel
                      settings={getSettings(id) as Warehouse112Settings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}

                  {expanded && tplMode === "warehouse-410" ? (
                    <Warehouse410SettingsPanel
                      settings={getSettings(id) as Warehouse410Settings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}

                  {expanded && tplMode === "warehouse-600" ? (
                    <Warehouse600SettingsPanel
                      settings={getSettings(id) as Warehouse600Settings}
                      onChange={(next) => updateTemplateSettings(id, next)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-border bg-muted/20 px-6 py-4">
          <button
            type="button"
            className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
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
