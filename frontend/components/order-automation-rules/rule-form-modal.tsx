"use client";

import { AutomationFormMultiSelect } from "@/components/order-automation-rules/automation-form-multi-select";
import {
  EXECUTION_TYPE_OPTIONS,
  SOURCE_CHANNEL_OPTIONS
} from "@/components/order-automation-rules/automation-display";
import type { RuleFormState } from "@/components/order-automation-rules/order-automation-types";
import { entitiesToItems } from "@/components/work-slots/work-slots-multi-select";
import { Sparkles, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

const CONSIGNATION_UI = [
  { value: "all" as const, label: "Все" },
  { value: "yes" as const, label: "Да" },
  { value: "no" as const, label: "Нет" }
];

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-gray-700 transition-colors hover:border-border focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500";

const LABEL_CLASS = "mb-1 block text-xs font-medium text-gray-500";

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT_CLASS} cursor-pointer appearance-none pr-8`}>
          <option value="">{placeholder ?? label}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown />
      </div>
    </div>
  );
}

function ChevronDown() {
  return (
    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden>
        <path d="M1 1L5 5L9 1" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function optsToItems(opts: { value: string; label: string }[]) {
  return opts.map((o) => ({ id: o.value, title: o.label }));
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={LABEL_CLASS}>Название</label>
      <div className="relative">
        <input
          type="text"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="По умол."
          className={`${INPUT_CLASS} pr-9`}
        />
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-teal-500 hover:text-teal-700"
          title="Сгенерировать"
          tabIndex={-1}
        >
          <Sparkles size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function ConsignmentRadio({
  value,
  onChange
}: {
  value: RuleFormState["consignment_mode"];
  onChange: (v: RuleFormState["consignment_mode"]) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-gray-500">Консигнация</label>
      <div className="flex flex-wrap items-center gap-5">
        {CONSIGNATION_UI.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
            <input
              type="radio"
              name="consignment_mode"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 border-border text-teal-600 focus:ring-teal-500"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function ActiveSwitch({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">Активный</span>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={() => onChange(!active)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          active ? "bg-teal-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-card shadow transition-transform ${
            active ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function CheckboxGroup({
  label,
  requiredMark,
  options,
  value,
  onChange
}: {
  label: string;
  requiredMark?: boolean;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-gray-500">
        {label}
        {requiredMark ? <span className="text-red-500">*</span> : null}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={value.includes(opt.value)}
              onChange={(e) => {
                if (e.target.checked) onChange([...value, opt.value]);
                else onChange(value.filter((v) => v !== opt.value));
              }}
              className="h-4 w-4 rounded border-border text-teal-600 focus:ring-teal-500"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  wide,
  onClose,
  children,
  footer
}: {
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        className={`relative flex max-h-[min(90vh,720px)] flex-col overflow-hidden rounded-xl bg-card shadow-xl ${
          wide ? "w-full max-w-3xl" : "w-full max-w-[420px]"
        }`}
        role="dialog"
        aria-modal
        aria-labelledby="rule-form-modal-title"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 id="rule-form-modal-title" className="text-base font-semibold text-gray-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-muted hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  autoConfirm: boolean;
  isEdit: boolean;
  form: RuleFormState;
  setForm: (f: RuleFormState) => void;
  agents: { id: number; fio: string }[];
  warehouses: { id: number; name: string }[];
  paymentMethodFilterOpts: { value: string; label: string }[];
  tradeDirectionFilterOpts: { value: string; label: string }[];
  requestTypeFilterOpts: { value: string; label: string }[];
  territoryMultiselectOpts: { value: string; label: string }[];
  currencyFilterOpts: { value: string; label: string }[];
  refsLoading?: boolean;
  refsError?: boolean;
  onSubmit: () => void;
  saving: boolean;
};

export function RuleFormModal({
  open,
  onClose,
  autoConfirm,
  isEdit,
  form,
  setForm,
  agents,
  warehouses,
  paymentMethodFilterOpts,
  tradeDirectionFilterOpts,
  requestTypeFilterOpts,
  territoryMultiselectOpts,
  currencyFilterOpts,
  refsLoading = false,
  refsError = false,
  onSubmit,
  saving
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (p: Partial<RuleFormState>) => setForm({ ...form, ...p });

  const title = isEdit
    ? autoConfirm
      ? "Редактировать авто-подтверждение"
      : "Редактировать ограничение"
    : autoConfirm
      ? "Добавить авто-подтверждение"
      : "Добавить условие ограничение зак...";

  const warehouseItems = entitiesToItems(warehouses.map((w) => ({ id: w.id, name: w.name })));
  const agentItems = entitiesToItems(agents.map((a) => ({ id: a.id, name: a.fio })));
  const territoryItems = optsToItems(territoryMultiselectOpts);
  const paymentItems = optsToItems(paymentMethodFilterOpts);
  const tradeItems = optsToItems(tradeDirectionFilterOpts);

  const submitLabel = isEdit ? "Сохранить" : "Добавить";

  const footer = autoConfirm ? (
    <div className="flex justify-end">
      <button
        type="submit"
        form="rule-form-modal"
        disabled={saving || !form.name.trim() || refsLoading}
        className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  ) : (
    <button
      type="submit"
      form="rule-form-modal"
      disabled={saving || !form.name.trim() || refsLoading}
      className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
    >
      {submitLabel}
    </button>
  );

  return (
    <ModalShell title={title} wide={autoConfirm} onClose={onClose} footer={footer}>
      <form id="rule-form-modal" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        {refsError ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Не удалось загрузить справочники. Обновите страницу или проверьте доступ.
          </p>
        ) : null}
        {autoConfirm ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
            <div className="space-y-4">
              <NameField value={form.name} onChange={(name) => patch({ name })} />
              <AutomationFormMultiSelect
                label="Территория"
                items={territoryItems}
                selectedValues={form.territory_refs}
                onChange={(territory_refs) => patch({ territory_refs })}
                loading={refsLoading}
              />
              <AutomationFormMultiSelect
                label="Склад"
                items={warehouseItems}
                selectedValues={form.warehouse_ids}
                onChange={(warehouse_ids) => patch({ warehouse_ids })}
                loading={refsLoading}
              />
              <AutomationFormMultiSelect
                label="Направление торговли"
                placeholder="Направление торговли"
                items={tradeItems}
                selectedValues={form.trade_direction_refs}
                onChange={(trade_direction_refs) => patch({ trade_direction_refs })}
                loading={refsLoading}
              />
              <AutomationFormMultiSelect
                label="Агент"
                placeholder="Агент"
                items={agentItems}
                selectedValues={form.agent_user_ids}
                onChange={(agent_user_ids) => patch({ agent_user_ids })}
                loading={refsLoading}
              />
              <AmountFields form={form} patch={patch} showCurrencySuffix />
              <AutomationFormMultiSelect
                label="Способ оплаты"
                placeholder="Способ оплаты"
                items={paymentItems}
                selectedValues={form.payment_method_ref ? [form.payment_method_ref] : []}
                onChange={(next) => patch({ payment_method_ref: next[0] ?? "" })}
                multiple={false}
                loading={refsLoading}
              />
              <ActiveSwitch active={form.is_active} onChange={(is_active) => patch({ is_active })} />
            </div>

            <div className="space-y-4">
              <ConsignmentRadio
                value={form.consignment_mode}
                onChange={(consignment_mode) => patch({ consignment_mode })}
              />
              <CheckboxGroup
                label="Тип заявки"
                requiredMark
                options={requestTypeFilterOpts}
                value={form.request_type_refs}
                onChange={(request_type_refs) => patch({ request_type_refs })}
              />
              <CheckboxGroup
                label="Источник заявки"
                requiredMark
                options={SOURCE_CHANNEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={form.source_channels}
                onChange={(source_channels) =>
                  patch({ source_channels: source_channels as RuleFormState["source_channels"] })
                }
              />
              <div>
                <label className={LABEL_CLASS}>Комментарий</label>
                <textarea
                  value={form.comment}
                  onChange={(e) => patch({ comment: e.target.value })}
                  rows={3}
                  placeholder="По умол."
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>
              <div className="space-y-3 rounded-lg bg-muted p-4">
                <h4 className="text-sm font-medium text-gray-700">Ожидаемая дата отгрузки</h4>
                <SelectField
                  label="Тип выполнения"
                  value={form.execution_type}
                  options={EXECUTION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  onChange={(execution_type) =>
                    patch({ execution_type: execution_type as RuleFormState["execution_type"] })
                  }
                />
                {form.execution_type === "business_days_n" ? (
                  <>
                    <div>
                      <label className={LABEL_CLASS}>Значение N</label>
                      <input
                        type="number"
                        min={1}
                        value={form.n_value}
                        onChange={(e) => patch({ n_value: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Время</label>
                      <input
                        type="time"
                        value={form.execution_time}
                        onChange={(e) => patch({ execution_time: e.target.value })}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </>
                ) : null}
                {form.execution_type === "exact_time" ? (
                  <div>
                    <label className={LABEL_CLASS}>Время</label>
                    <input
                      type="time"
                      value={form.execution_time}
                      onChange={(e) => patch({ execution_time: e.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                ) : null}
                {form.execution_type === "instant" ? (
                  <p className="text-xs leading-relaxed text-gray-500">
                    Заказ будет подтвержден мгновенно при совпадении условий.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <NameField value={form.name} onChange={(name) => patch({ name })} />
            {currencyFilterOpts.length <= 1 ? (
              <div>
                <label className={LABEL_CLASS}>Валюта</label>
                <div className={`${INPUT_CLASS} bg-muted text-gray-600`}>
                  {currencyFilterOpts[0]?.label ?? form.currency_code}
                </div>
              </div>
            ) : (
              <SelectField
                label="Валюта"
                value={form.currency_code}
                options={currencyFilterOpts}
                onChange={(currency_code) => patch({ currency_code })}
              />
            )}
            <AmountFields form={form} patch={patch} showCurrencySuffix={false} />
            <AutomationFormMultiSelect
              label="Агент"
              placeholder="Агент"
              items={agentItems}
              selectedValues={form.agent_user_ids}
              onChange={(agent_user_ids) => patch({ agent_user_ids })}
              loading={refsLoading}
            />
            <AutomationFormMultiSelect
              label="Склад"
              items={warehouseItems}
              selectedValues={form.warehouse_ids}
              onChange={(warehouse_ids) => patch({ warehouse_ids })}
              loading={refsLoading}
            />
            <AutomationFormMultiSelect
              label="Способ оплаты"
              placeholder="Способ оплаты"
              items={paymentItems}
              selectedValues={form.payment_method_ref ? [form.payment_method_ref] : []}
              onChange={(next) => patch({ payment_method_ref: next[0] ?? "" })}
              multiple={false}
              loading={refsLoading}
            />
            <AutomationFormMultiSelect
              label="Направление торговли"
              placeholder="Направление торговли"
              items={tradeItems}
              selectedValues={form.trade_direction_refs}
              onChange={(trade_direction_refs) => patch({ trade_direction_refs })}
              loading={refsLoading}
            />
            <AutomationFormMultiSelect
              label="Территория"
              items={territoryItems}
              selectedValues={form.territory_refs}
              onChange={(territory_refs) => patch({ territory_refs })}
              loading={refsLoading}
            />
            <ConsignmentRadio
              value={form.consignment_mode}
              onChange={(consignment_mode) => patch({ consignment_mode })}
            />
          </div>
        )}
      </form>
    </ModalShell>
  );
}

function AmountFields({
  form,
  patch,
  showCurrencySuffix
}: {
  form: RuleFormState;
  patch: (p: Partial<RuleFormState>) => void;
  showCurrencySuffix: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={LABEL_CLASS}>Сумма от</label>
        {showCurrencySuffix ? (
          <div className="relative">
            <input
              type="number"
              value={form.amount_from}
              onChange={(e) => patch({ amount_from: e.target.value })}
              className={`${INPUT_CLASS} pr-11`}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {form.currency_code}
            </span>
          </div>
        ) : (
          <input
            type="number"
            value={form.amount_from}
            onChange={(e) => patch({ amount_from: e.target.value })}
            placeholder="Сумма от"
            className={INPUT_CLASS}
          />
        )}
      </div>
      <div>
        <label className={LABEL_CLASS}>Сумма до</label>
        {showCurrencySuffix ? (
          <div className="relative">
            <input
              type="number"
              value={form.amount_to}
              onChange={(e) => patch({ amount_to: e.target.value })}
              className={`${INPUT_CLASS} pr-11`}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {form.currency_code}
            </span>
          </div>
        ) : (
          <input
            type="number"
            value={form.amount_to}
            onChange={(e) => patch({ amount_to: e.target.value })}
            placeholder="Сумма до"
            className={INPUT_CLASS}
          />
        )}
      </div>
    </div>
  );
}
