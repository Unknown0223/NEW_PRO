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

/// Strategiya tanlovi UI da faqat eligible qoidalar bo‘lsa kerak.
bool strategyChoiceNeedsUi({
  required bool requiresChoice,
  required int eligibleRuleCount,
}) {
  return requiresChoice && eligibleRuleCount > 0;
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

/// Prefetch preview dan sheet rejimini hisoblash.
/// Faqat UI da ko‘rinadigan qoidalar — auto_apply yolg‘iz sheet ochmaydi.
BonusDiscountSheetMode decideSheetModeFromPreviewRules({
  required List<({double bonusQty, int giftProductCount})> bonuses,
  required List<double?> discountPcts,
  bool strategyRequiresChoice = false,
}) {
  final usableBonusCount = bonuses
      .where(
        (b) => isUsableBonusPreviewRule(
          bonusQty: b.bonusQty,
          giftProductCount: b.giftProductCount,
        ),
      )
      .length;
  final usableDiscountCount = discountPcts
      .where((pct) => isUsableDiscountPreviewRule(discountPct: pct))
      .length;
  return decideBonusDiscountSheetMode(
    usableBonusCount: usableBonusCount,
    usableDiscountCount: usableDiscountCount,
    strategyRequiresChoice: strategyRequiresChoice,
  );
}

/// Sheet o‘tkazib yuborilganda serverga yuboriladigan auto bayroqlar.
({bool applyBonus, bool applyDiscount}) skipFinishApplyFlags({
  required int autoApplyGiftCount,
  int autoApplyRuleCount = 0,
  double? autoDiscountPct,
}) {
  return (
    applyBonus: autoApplyGiftCount > 0 || autoApplyRuleCount > 0,
    applyDiscount: isUsableDiscountPreviewRule(discountPct: autoDiscountPct),
  );
}
