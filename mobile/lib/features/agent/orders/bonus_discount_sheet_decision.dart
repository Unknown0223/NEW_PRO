// Bonus/skidka bottom sheet: ochish yoki darhol yakunlash qarori (unit-testable).

enum BonusDiscountSheetMode {
  /// Bonus ham skidka ham yo‘q — sheet ochilmasin, zakaz tugatilsin.
  skipFinish,

  /// Faqat skidka — bonus tabi yashirinadi.
  discountOnly,

  /// Faqat bonus — skidka tabi yashirinadi.
  bonusOnly,

  /// Ikkala bo‘lim ham.
  both,
}

bool isUsableBonusPreviewRule({
  required double bonusQty,
  required int giftProductCount,
}) {
  return bonusQty > 0 && giftProductCount > 0;
}

bool isUsableDiscountPreviewRule({required double? discountPct}) {
  return discountPct != null && discountPct > 0;
}

BonusDiscountSheetMode decideBonusDiscountSheetMode({
  required int usableBonusCount,
  required int usableDiscountCount,
  bool strategyRequiresChoice = false,
}) {
  final hasBonus = usableBonusCount > 0 || strategyRequiresChoice;
  final hasDiscount = usableDiscountCount > 0;
  if (!hasBonus && !hasDiscount) return BonusDiscountSheetMode.skipFinish;
  if (!hasBonus) return BonusDiscountSheetMode.discountOnly;
  if (!hasDiscount) return BonusDiscountSheetMode.bonusOnly;
  return BonusDiscountSheetMode.both;
}

/// Prefetch preview dan sheet rejimini hisoblash (bonus qty+gift, skidka pct).
/// [autoApplyGiftCount] / [autoDiscountPct] — eligible bo‘sh bo‘lsa ham auto_apply signal.
BonusDiscountSheetMode decideSheetModeFromPreviewRules({
  required List<({double bonusQty, int giftProductCount})> bonuses,
  required List<double?> discountPcts,
  bool strategyRequiresChoice = false,
  int autoApplyGiftCount = 0,
  double? autoDiscountPct,
}) {
  var usableBonusCount = bonuses
      .where(
        (b) => isUsableBonusPreviewRule(
          bonusQty: b.bonusQty,
          giftProductCount: b.giftProductCount,
        ),
      )
      .length;
  if (usableBonusCount == 0 && autoApplyGiftCount > 0) {
    usableBonusCount = 1;
  }
  var usableDiscountCount = discountPcts
      .where((pct) => isUsableDiscountPreviewRule(discountPct: pct))
      .length;
  if (usableDiscountCount == 0 &&
      isUsableDiscountPreviewRule(discountPct: autoDiscountPct)) {
    usableDiscountCount = 1;
  }
  return decideBonusDiscountSheetMode(
    usableBonusCount: usableBonusCount,
    usableDiscountCount: usableDiscountCount,
    strategyRequiresChoice: strategyRequiresChoice,
  );
}
