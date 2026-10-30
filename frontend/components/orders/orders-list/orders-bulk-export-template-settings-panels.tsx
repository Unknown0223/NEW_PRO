"use client";

import {
  INVOICE_FIELD_LABELS,
  WAREHOUSE_600_FIELD_LABELS,
  type InvoiceTemplateFieldSettings,
  type NakladnoyTemplateSettings,
  type SheetGroupSettings,
  type Warehouse112Settings,
  type Warehouse410Settings,
  type Warehouse600Settings,
  type WarehouseGroupSettings
} from "@/lib/bulk-export-template-settings";
import type { NakladnoyGroupBy } from "@/lib/order-nakladnoy";
import { cn } from "@/lib/utils";

const GROUP_BY_OPTIONS: { value: NakladnoyGroupBy; label: string }[] = [
  { value: "territory", label: "По территории" },
  { value: "agent", label: "По агентам" },
  { value: "expeditor", label: "По экспедиторам" }
];

/** «Отделить по листам» yoqilganda varaqlar shu tanlov bo‘yicha nomlanadi. */
function SheetGroupFieldset<T extends SheetGroupSettings>({
  settings,
  onChange,
  templateId
}: {
  settings: T;
  onChange: (next: T) => void;
  templateId: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium text-muted-foreground">Выберите тип фильтрации</legend>
      {GROUP_BY_OPTIONS.map(({ value, label }) => (
        <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name={`group-${templateId}`}
            className="accent-teal-600"
            checked={settings.groupBy === value}
            onChange={() => onChange({ ...settings, groupBy: value })}
          />
          {label}
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        При «Отделить по листам» каждый лист называется по выбранному типу.
      </p>
    </fieldset>
  );
}

export function WarehouseGroupSettingsPanel({
  settings,
  onChange,
  templateId
}: {
  settings: WarehouseGroupSettings;
  onChange: (next: WarehouseGroupSettings) => void;
  templateId: string;
}) {
  return (
    <div className="mt-3 border-t border-border/80 pt-3">
      <SheetGroupFieldset templateId={templateId} settings={settings} onChange={onChange} />
    </div>
  );
}

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

      <SheetGroupFieldset templateId={templateId} settings={settings} onChange={onChange} />
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
  onChange,
  templateId
}: {
  settings: Warehouse112Settings;
  onChange: (next: Warehouse112Settings) => void;
  templateId: string;
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
      <SheetGroupFieldset templateId={templateId} settings={settings} onChange={onChange} />
    </div>
  );
}

export function Warehouse410SettingsPanel({
  settings,
  onChange,
  templateId
}: {
  settings: Warehouse410Settings;
  onChange: (next: Warehouse410Settings) => void;
  templateId: string;
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
      <SheetGroupFieldset templateId={templateId} settings={settings} onChange={onChange} />
    </div>
  );
}

export function Warehouse600SettingsPanel({
  settings,
  onChange,
  templateId
}: {
  settings: Warehouse600Settings;
  onChange: (next: Warehouse600Settings) => void;
  templateId: string;
}) {
  return (
    <>
      <CheckboxList
        fields={WAREHOUSE_600_FIELD_LABELS}
        settings={settings}
        onChange={(next) => onChange({ ...settings, ...next })}
      />
      <div className="mt-3">
        <SheetGroupFieldset templateId={templateId} settings={settings} onChange={onChange} />
      </div>
    </>
  );
}

export function InvoiceTemplateSettingsPanel({
  settings,
  onChange,
  templateId
}: {
  settings: InvoiceTemplateFieldSettings;
  onChange: (next: InvoiceTemplateFieldSettings) => void;
  templateId: string;
}) {
  const allKeys = INVOICE_FIELD_LABELS.map((f) => f.key);
  const allOn = allKeys.every((k) => settings[k]);

  const setField = (key: (typeof allKeys)[number], value: boolean) => {
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
            onChange({
              ...settings,
              ...(Object.fromEntries(allKeys.map((k) => [k, v])) as Record<(typeof allKeys)[number], boolean>)
            });
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
      <div className="pt-1">
        <SheetGroupFieldset templateId={templateId} settings={settings} onChange={onChange} />
      </div>
    </div>
  );
}
