"use client";

import { BonusRuleProductDualPanels } from "@/components/bonus-rules/bonus-rule-product-dual-panels";
import { BonusRuleSelectedClientsField } from "@/components/bonus-rules/bonus-rule-selected-clients-field";
import {
  BonusRuleFloatingInput,
  BonusRuleSection,
  BonusRuleTemplateCheckbox,
  BonusRuleTemplateRadioGroup
} from "@/components/bonus-rules/bonus-rule-form-fields";
import type { ClauseFormState, CondForm } from "@/components/bonus-rules/bonus-rule-clause-state";
import { emptyCond } from "@/components/bonus-rules/bonus-rule-clause-state";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  value: ClauseFormState;
  onChange: (next: ClauseFormState) => void;
  onRemove: () => void;
  disabled?: boolean;
  tenantSlug: string;
  bonusType: "qty" | "sum";
};

function patch(value: ClauseFormState, onChange: (n: ClauseFormState) => void, p: Partial<ClauseFormState>) {
  onChange({ ...value, ...p });
}

export function BonusRuleExtraClauseCard({
  title,
  value,
  onChange,
  onRemove,
  disabled,
  tenantSlug,
  bonusType
}: Props) {
  const showBonusCol =
    value.grantsReward && !(value.onlyByAssortment && !value.onlyByCategory);

  return (
    <BonusRuleSection className="border-teal-700/25 bg-teal-50/30 dark:bg-teal-950/20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onRemove}>
          Удалить
        </Button>
      </div>

      <BonusRuleTemplateCheckbox
        checked={value.grantsReward}
        onChange={(v) => patch(value, onChange, { grantsReward: v })}
        disabled={disabled}
        label="Выдать бонус по этому условию"
      />
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        Если галочка снята — условие только проверяется; бонус-товар не выбирается.
      </p>

      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BonusRuleFloatingInput
          id={`cl-pri-${value.key}`}
          label="Приоритет"
          value={value.priority}
          onChange={(e) => patch(value, onChange, { priority: e.target.value })}
          disabled={disabled}
        />
        <BonusRuleFloatingInput
          id={`cl-cc-${value.key}`}
          label="Категория клиента"
          value={value.clientCategory}
          onChange={(e) => patch(value, onChange, { clientCategory: e.target.value })}
          disabled={disabled}
        />
        <BonusRuleFloatingInput
          id={`cl-pt-${value.key}`}
          label="Тип цены"
          value={value.priceType}
          onChange={(e) => patch(value, onChange, { priceType: e.target.value })}
          disabled={disabled}
        />
        <BonusRuleFloatingInput
          id={`cl-pay-${value.key}`}
          label="Способ оплаты"
          value={value.paymentType}
          onChange={(e) => patch(value, onChange, { paymentType: e.target.value })}
          disabled={disabled}
        />
      </div>

      <BonusRuleTemplateRadioGroup
        title="Для кого"
        name={`cl-target-${value.key}`}
        value={value.targetAllClients ? "all" : "selected"}
        onChange={(v) => patch(value, onChange, { targetAllClients: v === "all" })}
        disabled={disabled}
        options={[
          { value: "all", label: "Все клиенты" },
          { value: "selected", label: "Избранные клиенты" }
        ]}
      />

      <div className="mt-2 flex flex-wrap gap-3">
        <BonusRuleTemplateCheckbox
          checked={value.inBlocks}
          muted={!value.inBlocks}
          onChange={(v) => patch(value, onChange, { inBlocks: v })}
          disabled={disabled}
          label="По блокам"
        />
        <BonusRuleTemplateCheckbox
          checked={value.onlyByAssortment}
          muted={!value.onlyByAssortment}
          onChange={(v) =>
            patch(value, onChange, {
              onlyByAssortment: v,
              onlyByCategory: v ? false : value.onlyByCategory,
              selectedCategoryIds: v ? [] : value.selectedCategoryIds,
              bonusProductIds: v ? [] : value.bonusProductIds,
              triggerProductIds: v ? value.triggerProductIds : []
            })
          }
          disabled={disabled}
          label="Только ассортимент"
        />
        <BonusRuleTemplateCheckbox
          checked={value.onlyByCategory}
          muted={!value.onlyByCategory}
          onChange={(v) =>
            patch(value, onChange, {
              onlyByCategory: v,
              onlyByAssortment: v ? false : value.onlyByAssortment
            })
          }
          disabled={disabled}
          label="Категория"
        />
        <BonusRuleTemplateCheckbox
          checked={value.oncePerClient}
          muted={!value.oncePerClient}
          onChange={(v) => patch(value, onChange, { oncePerClient: v })}
          disabled={disabled}
          label="Один раз на клиента"
        />
      </div>

      {!value.targetAllClients ? (
        <div className="mt-3">
          <BonusRuleSelectedClientsField
            tenantSlug={tenantSlug}
            selectedIds={value.selectedClientIds}
            nameById={value.selectedClientNames}
            disabled={!!disabled}
            onChange={(ids, namePatch) => {
              const nextNames = { ...value.selectedClientNames };
              for (const [k, n] of Object.entries(namePatch)) {
                const id = Number(k);
                if (!n.trim()) delete nextNames[id];
                else nextNames[id] = n;
              }
              patch(value, onChange, { selectedClientIds: ids, selectedClientNames: nextNames });
            }}
          />
        </div>
      ) : null}

      <div className="mt-4">
        <BonusRuleProductDualPanels
          tenantSlug={tenantSlug}
          triggerProductIds={value.triggerProductIds}
          bonusProductIds={value.bonusProductIds}
          onTriggerChange={(ids) => patch(value, onChange, { triggerProductIds: ids })}
          onBonusChange={(ids) => patch(value, onChange, { bonusProductIds: ids })}
          onlyByAssortment={value.onlyByAssortment}
          onlyByCategory={value.onlyByCategory}
          selectedCategoryIds={value.selectedCategoryIds}
          onSelectedCategoryIdsChange={(ids) => patch(value, onChange, { selectedCategoryIds: ids })}
          showTriggerColumn={value.onlyByAssortment || value.onlyByCategory}
          showBonusColumn={showBonusCol}
          disabled={!!disabled}
        />
      </div>

      {bonusType === "qty" ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">Условия (кол-во)</p>
          {value.conditions.map((row, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <BonusRuleFloatingInput
                id={`cl-step-${value.key}-${i}`}
                label="Шаг"
                value={row.step_qty}
                onChange={(e) => {
                  const conditions = value.conditions.map((c, j) =>
                    j === i ? { ...c, step_qty: e.target.value } : c
                  );
                  patch(value, onChange, { conditions });
                }}
                disabled={disabled}
              />
              <BonusRuleFloatingInput
                id={`cl-bq-${value.key}-${i}`}
                label="Бонус"
                value={row.bonus_qty}
                onChange={(e) => {
                  const conditions = value.conditions.map((c, j) =>
                    j === i ? { ...c, bonus_qty: e.target.value } : c
                  );
                  patch(value, onChange, { conditions });
                }}
                disabled={disabled}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              patch(value, onChange, { conditions: [...value.conditions, emptyCond() as CondForm] })
            }
          >
            + Строка
          </Button>
        </div>
      ) : (
        <div className="mt-4 max-w-sm">
          <BonusRuleFloatingInput
            id={`cl-minsum-${value.key}`}
            label="Мин. сумма"
            value={value.minSum}
            onChange={(e) => patch(value, onChange, { minSum: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}
    </BonusRuleSection>
  );
}
