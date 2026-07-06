"use client";

import { BonusRuleTemplateCheckbox } from "@/components/bonus-rules/bonus-rule-form-fields";

type Props = {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
};

/** «Категория» rejimini yoqish/o‘chirish — shablon checkbox. */
export function BonusRuleCategoryHoverField({ checked, onCheckedChange, disabled = false }: Props) {
  return (
    <BonusRuleTemplateCheckbox
      checked={checked}
      muted={!checked}
      disabled={disabled}
      onChange={onCheckedChange}
      label="Категория"
    />
  );
}
