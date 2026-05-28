"use client";

import {
  INVOICE_FIELD_LABELS,
  WAREHOUSE_600_FIELD_LABELS,
  type InvoiceTemplateFieldSettings,
  type NakladnoyTemplateSettings,
  type Warehouse112Settings,
  type Warehouse410Settings,
  type Warehouse600Settings
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

function CheckboxList<T extends string>({
  fields,
  settings,
  onChange
}: {
  fields: { key: T; label: string }[];
  settings: Record<T, boolean>;
  onChange: (next: Record<T, boolean>) => void;
}) {
  const allKeys = fields.map((f) => f.key);
  const allOn = allKeys.every((k) => settings[k]);

  return (
    <div className="mt-3 space-y-2 border-t border-border/80 pt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-teal-600"
          checked={allOn}
          onChange={(e) => {
            const v = e.target.checked;
            onChange(Object.fromEntries(allKeys.map((k) => [k, v])) as Record<T, boolean>);
          }}
        />
        Выбрать все
      </label>
      {fields.map(({ key, label }) => (
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
            onChange={(e) => onChange({ ...settings, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function Warehouse112SettingsPanel({
  settings,
  onChange
}: {
  settings: Warehouse112Settings;
  onChange: (next: Warehouse112Settings) => void;
}) {
  return (
    <div className="mt-3 space-y-2 border-t border-border/80 pt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-teal-600"
          checked={settings.sortProducts}
          onChange={(e) => onChange({ ...settings, sortProducts: e.target.checked })}
        />
        Сортировка
      </label>
    </div>
  );
}

export function Warehouse410SettingsPanel({
  settings,
  onChange
}: {
  settings: Warehouse410Settings;
  onChange: (next: Warehouse410Settings) => void;
}) {
  return (
    <div className="mt-3 space-y-2 border-t border-border/80 pt-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-teal-600"
          checked={settings.showBarcode}
          onChange={(e) => onChange({ ...settings, showBarcode: e.target.checked })}
        />
        Штрих-Код
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded border-input accent-teal-600"
          checked={settings.showSku}
          onChange={(e) => onChange({ ...settings, showSku: e.target.checked })}
        />
        Код
      </label>
    </div>
  );
}

export function Warehouse600SettingsPanel({
  settings,
  onChange
}: {
  settings: Warehouse600Settings;
  onChange: (next: Warehouse600Settings) => void;
}) {
  return (
    <CheckboxList
      fields={WAREHOUSE_600_FIELD_LABELS}
      settings={settings}
      onChange={(next) => onChange(next as Warehouse600Settings)}
    />
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
