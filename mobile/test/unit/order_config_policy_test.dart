import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/order_config_policy.dart';
import 'package:salesdoc_mobile/features/agent/orders/bonus_fill_policy.dart';

void main() {
  group('bonusFillPolicyFromOrders', () {
    test('maps known modes', () {
      expect(
        bonusFillPolicyFromOrders(const OrdersConfig(bonusFillMode: 'free')),
        BonusFillPolicy.free,
      );
      expect(
        bonusFillPolicyFromOrders(const OrdersConfig(bonusFillMode: 'all_required')),
        BonusFillPolicy.allRequired,
      );
      expect(
        bonusFillPolicyFromOrders(
          const OrdersConfig(bonusFillMode: 'auto_fill_remaining'),
        ),
        BonusFillPolicy.autoFillRemaining,
      );
    });

    test('defaults unknown / null to autoFillRemaining', () {
      expect(
        bonusFillPolicyFromOrders(const OrdersConfig()),
        BonusFillPolicy.autoFillRemaining,
      );
      expect(
        bonusFillPolicyFromOrders(const OrdersConfig(bonusFillMode: 'legacy')),
        BonusFillPolicy.autoFillRemaining,
      );
    });
  });

  group('defaultBonusModeKey', () {
    test('all policies start on auto so gifts are shown', () {
      expect(
        defaultBonusModeKey(const OrdersConfig(bonusFillMode: 'free')),
        'auto',
      );
      expect(
        defaultBonusModeKey(const OrdersConfig(bonusFillMode: 'all_required')),
        'auto',
      );
      expect(
        defaultBonusModeKey(
          const OrdersConfig(bonusFillMode: 'auto_fill_remaining'),
        ),
        'auto',
      );
    });
  });

  group('isBonusModeKeyAllowed', () {
    test('free allows auto and none', () {
      const orders = OrdersConfig(bonusFillMode: 'free');
      expect(isBonusModeKeyAllowed(orders, 'auto'), isTrue);
      expect(isBonusModeKeyAllowed(orders, 'none'), isTrue);
      expect(isBonusModeKeyAllowed(orders, 'manual'), isFalse);
    });

    test('all_required and auto_fill_remaining allow only auto', () {
      for (final mode in ['all_required', 'auto_fill_remaining']) {
        final orders = OrdersConfig(bonusFillMode: mode);
        expect(isBonusModeKeyAllowed(orders, 'auto'), isTrue);
        expect(isBonusModeKeyAllowed(orders, 'none'), isFalse);
      }
    });
  });

  group('shouldAutoFillBonuses / requiresCompleteBonusFill', () {
    test('only auto_fill_remaining auto-fills', () {
      expect(shouldAutoFillBonuses(BonusFillPolicy.free), isFalse);
      expect(shouldAutoFillBonuses(BonusFillPolicy.allRequired), isFalse);
      expect(shouldAutoFillBonuses(BonusFillPolicy.autoFillRemaining), isTrue);
    });

    test('all_required and auto_fill_remaining require complete fill', () {
      expect(requiresCompleteBonusFill(BonusFillPolicy.free), isFalse);
      expect(requiresCompleteBonusFill(BonusFillPolicy.allRequired), isTrue);
      expect(requiresCompleteBonusFill(BonusFillPolicy.autoFillRemaining), isTrue);
    });
  });

  group('bonusFillCompletenessError', () {
    test('null when all earned rules fully selected', () {
      expect(
        bonusFillCompletenessError(
          rules: const [
            BonusRuleFillState(ruleId: 1, earnedQty: 5, selectedQty: 5),
            BonusRuleFillState(ruleId: 2, earnedQty: 0, selectedQty: 0),
          ],
          strategies: const [],
          incompleteBonusMessage: 'incomplete',
          strategyChoiceMessage: 'strategy',
        ),
        isNull,
      );
    });

    test('returns incomplete when selected < earned', () {
      expect(
        bonusFillCompletenessError(
          rules: const [
            BonusRuleFillState(ruleId: 1, earnedQty: 5, selectedQty: 3),
          ],
          strategies: const [],
          incompleteBonusMessage: 'incomplete',
          strategyChoiceMessage: 'strategy',
        ),
        'incomplete',
      );
    });

    test('skips rules with agentMustFill false', () {
      expect(
        bonusFillCompletenessError(
          rules: const [
            BonusRuleFillState(
              ruleId: 1,
              earnedQty: 5,
              selectedQty: 0,
              agentMustFill: false,
            ),
          ],
          strategies: const [],
          incompleteBonusMessage: 'incomplete',
          strategyChoiceMessage: 'strategy',
        ),
        isNull,
      );
    });

    test('requires strategy choice when flagged', () {
      expect(
        bonusFillCompletenessError(
          rules: const [
            BonusRuleFillState(ruleId: 1, earnedQty: 2, selectedQty: 2),
          ],
          strategies: const [
            BonusStrategyFillState(
              strategyId: 9,
              requiresChoice: true,
              maxSelect: 1,
              pickedCount: 0,
            ),
          ],
          incompleteBonusMessage: 'incomplete',
          strategyChoiceMessage: 'strategy',
        ),
        'strategy',
      );
    });
  });

  group('fillRemainingGiftQtyMap', () {
    test('tops up without wiping existing picks', () {
      final next = fillRemainingGiftQtyMap(
        earnedQty: 10,
        currentQtyByProduct: {1: 3, 2: 0, 3: 2},
        giftProductIds: const [1, 2, 3],
        // Cap existing products so remaining goes to empty slot.
        stockCapFor: (pid, cur) {
          if (pid == 1) return 3;
          if (pid == 3) return 2;
          return 100;
        },
      );
      expect(next[1], 3);
      expect(next[3], 2);
      expect(next[2], 5);
      expect(next[1]! + next[2]! + next[3]!, 10);
    });

    test('respects stock caps', () {
      final next = fillRemainingGiftQtyMap(
        earnedQty: 10,
        currentQtyByProduct: {1: 2, 2: 0},
        giftProductIds: const [1, 2],
        stockCapFor: (pid, cur) => pid == 1 ? 2 : 4,
      );
      expect(next[1], 2);
      expect(next[2], 4);
    });
  });

  group('anyGiftQtySelected', () {
    test('detects any positive qty', () {
      expect(anyGiftQtySelected({}), isFalse);
      expect(anyGiftQtySelected({1: {10: 0}}), isFalse);
      expect(anyGiftQtySelected({1: {10: 2}}), isTrue);
    });
  });

  group('resolveBonusGiftUiMode', () {
    test('free multi-pick → redistribute', () {
      expect(
        resolveBonusGiftUiMode(
          policy: BonusFillPolicy.free,
          supportsMultiGiftPick: true,
          isAssortmentAuto: false,
          isLockedAutoGift: false,
          giftProductCount: 3,
        ),
        BonusGiftUiMode.redistribute,
      );
    });

    test('free single gift → qtyStepper', () {
      expect(
        resolveBonusGiftUiMode(
          policy: BonusFillPolicy.free,
          supportsMultiGiftPick: false,
          isAssortmentAuto: false,
          isLockedAutoGift: false,
          giftProductCount: 1,
        ),
        BonusGiftUiMode.qtyStepper,
      );
    });

    test('free assortment_auto → lockedDisplay', () {
      expect(
        resolveBonusGiftUiMode(
          policy: BonusFillPolicy.free,
          supportsMultiGiftPick: false,
          isAssortmentAuto: true,
          isLockedAutoGift: false,
          giftProductCount: 4,
        ),
        BonusGiftUiMode.lockedDisplay,
      );
    });

    test('all_required / auto_fill single → lockedDisplay', () {
      for (final p in [
        BonusFillPolicy.allRequired,
        BonusFillPolicy.autoFillRemaining,
      ]) {
        expect(
          resolveBonusGiftUiMode(
            policy: p,
            supportsMultiGiftPick: false,
            isAssortmentAuto: false,
            isLockedAutoGift: false,
            giftProductCount: 1,
          ),
          BonusGiftUiMode.lockedDisplay,
        );
      }
    });

    test('all_required multi-pick → redistribute', () {
      expect(
        resolveBonusGiftUiMode(
          policy: BonusFillPolicy.allRequired,
          supportsMultiGiftPick: true,
          isAssortmentAuto: false,
          isLockedAutoGift: false,
          giftProductCount: 2,
        ),
        BonusGiftUiMode.redistribute,
      );
    });

    test('shouldPreserveBonusGiftTotal only for required modes', () {
      expect(shouldPreserveBonusGiftTotal(BonusFillPolicy.free), isFalse);
      expect(shouldPreserveBonusGiftTotal(BonusFillPolicy.allRequired), isTrue);
      expect(
        shouldPreserveBonusGiftTotal(BonusFillPolicy.autoFillRemaining),
        isTrue,
      );
    });
  });
}
