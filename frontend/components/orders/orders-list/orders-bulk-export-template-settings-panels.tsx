"use client";

import {
  INVOICE_FIELD_LABELS,
  type InvoiceTemplateFieldSettings,
  type NakladnoyTemplateSettings
} from "@/lib/bulk-export-template-settings";
import { cn } from "@/lib/utils";

export function NakladnoyTemplateSettingsPanel({
  settings,
  onChange,
  templateId
}: {
  settings: NakladnoyTemplateSettings;
  onChange: (next: NakladnoyTemplateSettings) => void;
  templateId: string;
}) {
  return (
    <div className="mt-3 space-y-3 border-t border-border/80 pt-3">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">Выберите тип кода</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`code-${templateId}`}
            className="accent-teal-600"
            checked={settings.codeColumn === "sku"}
            onChange={() => onChange({ ...settings, codeColumn: "sku" })}
          />
          Код
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`code-${templateId}`}
            className="accent-teal-600"
            checked={settings.codeColumn === "barcode"}
            onChange={() => onChange({ ...settings, codeColumn: "barcode" })}
          />
          Штрих-код
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground">Выберите тип фильтрации</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`group-${templateId}`}
            className="accent-teal-600"
            checked={settings.groupBy === "territory"}
            onChange={() => onChange({ ...settings, groupBy: "territory" })}
          />
          По территории
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`group-${templateId}`}
            className="accent-teal-600"
            checked={settings.groupBy === "agent"}
            onChange={() => onChange({ ...settings, groupBy: "agent" })}
          />
          По агентам
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`group-${templateId}`}
            className="accent-teal-600"
            checked={settings.groupBy === "expeditor"}
            onChange={() => onChange({ ...settings, groupBy: "expeditor" })}
          />
          По экспедиторам
        </label>
      </fieldset>
    </div>
  );
}

export function InvoiceTemplateSettingsPanel({
  settings,
  onChange
}: {
  settings: InvoiceTemplateFieldSettings;
  onChange: (next: InvoiceTemplateFieldSettings) => void;
}) {
  const allKeys = INVOICE_FIELD_LABELS.map((f) => f.key);
  const allOn = allKeys.every((k) => settings[k]);

  const setField = (key: keyof InvoiceTemplateFieldSettings, value: boolean) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="mt-3 space-y-2 border-t border-border/80 pt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-teal-600"
          checked={allOn}
          onChange={(e) => {
            const v = e.target.checked;
            onChange(
              Object.fromEntries(allKeys.map((k) => [k, v])) as InvoiceTemplateFieldSettings
            );
          }}
        />
        Выбрать все
      </label>
      {INVOICE_FIELD_LABELS.map(({ key, label }) => (
        <label
          key={key}
          className={cn(
            "flex cursor-pointer items-center gap-2 text-sm",
            !settings[key] && "text-muted-foreground"
          )}
        >
          <input
            type="checkbox"
            className="size-4 rounded border-input accent-teal-600"
            checked={settings[key]}
            onChange={(e) => setField(key, e.target.checked)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
