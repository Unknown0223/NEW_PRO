import 'mobile_config.dart';
import 'tenant_references.dart';

/// `bonus_fill_mode`: free | all_required | auto_fill_remaining
enum BonusFillPolicy {
  free,
  allRequired,
  autoFillRemaining,
}

BonusFillPolicy bonusFillPolicyFromOrders(OrdersConfig orders) {
  switch (orders.bonusFillMode) {
    case 'free':
      return BonusFillPolicy.free;
    case 'all_required':
      return BonusFillPolicy.allRequired;
    case 'auto_fill_remaining':
      return BonusFillPolicy.autoFillRemaining;
    default:
      return BonusFillPolicy.autoFillRemaining;
  }
}

/// Always start on «Авто» so earned gifts are visible (including `free`).
String defaultBonusModeKey(OrdersConfig orders) {
  switch (bonusFillPolicyFromOrders(orders)) {
    case BonusFillPolicy.free:
    case BonusFillPolicy.allRequired:
    case BonusFillPolicy.autoFillRemaining:
      return 'auto';
  }
}

bool isBonusModeKeyAllowed(OrdersConfig orders, String modeKey) {
  // Manual bonus rejim olib tashlangan — faqat auto | none.
  if (modeKey == 'manual') return false;
  switch (bonusFillPolicyFromOrders(orders)) {
    case BonusFillPolicy.free:
      return modeKey == 'auto' || modeKey == 'none';
    case BonusFillPolicy.allRequired:
    case BonusFillPolicy.autoFillRemaining:
      return modeKey == 'auto';
  }
}

bool shouldAutoFillBonuses(BonusFillPolicy policy) =>
    policy == BonusFillPolicy.autoFillRemaining;

bool requiresCompleteBonusFill(BonusFillPolicy policy) =>
    policy == BonusFillPolicy.allRequired ||
    policy == BonusFillPolicy.autoFillRemaining;

/// How the agent interacts with gift products for a rule.
enum BonusGiftUiMode {
  /// System qty only (required single / locked assortment).
  lockedDisplay,

  /// Free + single gift: +/- from 0…max, no product swap.
  qtyStepper,

  /// Multi gift: redistribute with +/- (free may go below max; required must keep sum ≥ max).
  redistribute,
}

/// Resolves gift UI for workplace `bonus_fill_mode` + rule shape.
BonusGiftUiMode resolveBonusGiftUiMode({
  required BonusFillPolicy policy,
  required bool supportsMultiGiftPick,
  required bool isAssortmentAuto,
  required bool isLockedAutoGift,
  required int giftProductCount,
}) {
  if (supportsMultiGiftPick) return BonusGiftUiMode.redistribute;

  if (policy == BonusFillPolicy.free) {
    // Assortment / locked multi-SKU: system lines only.
    if (isAssortmentAuto || (isLockedAutoGift && giftProductCount > 1)) {
      return BonusGiftUiMode.lockedDisplay;
    }
    if (giftProductCount <= 1) return BonusGiftUiMode.qtyStepper;
    return BonusGiftUiMode.lockedDisplay;
  }

  // all_required / auto_fill_remaining: single (or locked) → read-only max qty.
  return BonusGiftUiMode.lockedDisplay;
}

/// Required multi-pick: keep total at max when agent redistributes.
bool shouldPreserveBonusGiftTotal(BonusFillPolicy policy) =>
    requiresCompleteBonusFill(policy);

bool shouldApplyBonusFromKey(String modeKey) => modeKey == 'auto';

List<PaymentMethodRef> filterAllowedPaymentMethods(
  List<PaymentMethodRef> methods,
  MiscConfig misc,
) {
  final blocked = misc.disallowedPaymentMethodCodes;
  if (blocked.isEmpty) return methods;
  return methods.where((m) {
    if (blocked.contains(m.id)) return false;
    if (m.code != null && blocked.contains(m.code!)) return false;
    if (blocked.contains(m.paymentType)) return false;
    return true;
  }).toList();
}
