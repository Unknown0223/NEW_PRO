"use client";

import { Button } from "@/components/ui/button";
import { BonusRuleProductCategoryTree } from "@/components/bonus-rules/bonus-rule-product-category-tree";

export type BonusRuleProductScopePickerProps = {
  tenantSlug: string;
  value: number[];
  onChange: (productIds: number[]) => void;
  /** Tanlangan mahsulotlar bilan qamrov — `product_category_ids` AND bo‘lmasin */
  onClearCategoryScope?: () => void;
  disabled?: boolean;
};

export function BonusRuleProductScopePicker({
  tenantSlug,
  value,
  onChange,
  onClearCategoryScope,
  disabled
}: BonusRuleProductScopePickerProps) {
  if (!tenantSlug) return null;

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Откройте категорию и отметьте товары. Бонус начисляется только по строкам выбранных товаров (
          <span className="font-mono text-xs">product_ids</span>).
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([])} disabled={disabled || value.length === 0}>
          Очистить выбор
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Выбрано товаров: <span className="font-medium text-foreground">{value.length}</span>
      </p>

      <div className="max-h-[min(28rem,60vh)] overflow-y-auto">
        <BonusRuleProductCategoryTree
          tenantSlug={tenantSlug}
          value={value}
          onChange={onChange}
          disabled={disabled}
          querySuffix="scope-picker"
          onSelectionIntent={onClearCategoryScope}
        />
      </div>
    </div>
  );
}
