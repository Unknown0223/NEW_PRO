export function wholeCategoryIncludesAllSkus(
  categoryIds: readonly number[],
  productIds: readonly number[]
): boolean {
  return categoryIds.length > 0 && productIds.length === 0;
}

export function bonusRuleColumnFooter(opts: {
  productCount: number;
  categoryCount: number;
  categoryMode: boolean;
  locked: boolean;
  unused?: boolean;
}): string {
  if (opts.categoryMode && opts.categoryCount > 0 && opts.productCount === 0) {
    const base =
      opts.categoryCount === 1
        ? "Категория: все товары внутри"
        : `Категории: ${opts.categoryCount} · все товары внутри`;
    return opts.locked ? `${base} · только просмотр` : base;
  }
  if (opts.categoryMode && opts.categoryCount > 0) {
    const base = `Категории: ${opts.categoryCount} · SKU: ${opts.productCount}`;
    return opts.locked ? `${base} · только просмотр` : base;
  }
  const base = `Выбрано: ${opts.productCount}`;
  if (opts.locked) return `${base} · только просмотр`;
  if (opts.unused) return `${base} (не используется)`;
  return base;
}
