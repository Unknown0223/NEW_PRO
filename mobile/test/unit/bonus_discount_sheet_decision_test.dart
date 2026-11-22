import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/agent/orders/bonus_discount_sheet_decision.dart';

void main() {
  group('decideBonusDiscountSheetMode', () {
    test('skips sheet when no bonus and no discount', () {
      expect(
        decideBonusDiscountSheetMode(usableBonusCount: 0, usableDiscountCount: 0),
        BonusDiscountSheetMode.skipFinish,
      );
    });

    test('discount only when bonuses empty', () {
      expect(
        decideBonusDiscountSheetMode(usableBonusCount: 0, usableDiscountCount: 2),
        BonusDiscountSheetMode.discountOnly,
      );
    });

    test('bonus only when discounts empty', () {
      expect(
        decideBonusDiscountSheetMode(usableBonusCount: 1, usableDiscountCount: 0),
        BonusDiscountSheetMode.bonusOnly,
      );
    });

    test('both when each side has items', () {
      expect(
        decideBonusDiscountSheetMode(usableBonusCount: 1, usableDiscountCount: 1),
        BonusDiscountSheetMode.both,
      );
    });

    test('strategy choice keeps bonus section even without listed bonuses', () {
      expect(
        decideBonusDiscountSheetMode(
          usableBonusCount: 0,
          usableDiscountCount: 0,
          strategyRequiresChoice: true,
        ),
        BonusDiscountSheetMode.bonusOnly,
      );
    });
  });

  group('usable preview rules', () {
    test('bonus needs qty and gift products', () {
      expect(isUsableBonusPreviewRule(bonusQty: 2, giftProductCount: 1), isTrue);
      expect(isUsableBonusPreviewRule(bonusQty: 2, giftProductCount: 0), isFalse);
      expect(isUsableBonusPreviewRule(bonusQty: 0, giftProductCount: 3), isFalse);
    });

    test('discount needs positive pct', () {
      expect(isUsableDiscountPreviewRule(discountPct: 5), isTrue);
      expect(isUsableDiscountPreviewRule(discountPct: 0), isFalse);
      expect(isUsableDiscountPreviewRule(discountPct: null), isFalse);
    });
  });

  group('decideSheetModeFromPreviewRules', () {
    test('filters fake bonus without gifts and skips when empty', () {
      expect(
        decideSheetModeFromPreviewRules(
          bonuses: [(bonusQty: 5, giftProductCount: 0)],
          discountPcts: [0, null],
        ),
        BonusDiscountSheetMode.skipFinish,
      );
    });

    test('discount only when only usable discounts remain', () {
      expect(
        decideSheetModeFromPreviewRules(
          bonuses: [(bonusQty: 1, giftProductCount: 0)],
          discountPcts: [10],
        ),
        BonusDiscountSheetMode.discountOnly,
      );
    });

    test('auto_apply gifts keep bonus section when eligible empty', () {
      expect(
        decideSheetModeFromPreviewRules(
          bonuses: [],
          discountPcts: [],
          autoApplyGiftCount: 2,
        ),
        BonusDiscountSheetMode.bonusOnly,
      );
    });

    test('auto discount pct keeps discount when eligible empty', () {
      expect(
        decideSheetModeFromPreviewRules(
          bonuses: [],
          discountPcts: [0, null],
          autoDiscountPct: 5,
        ),
        BonusDiscountSheetMode.discountOnly,
      );
    });
  });
}
