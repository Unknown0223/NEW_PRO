import 'mobile_config.dart';
import 'tenant_references.dart';

/// `bonus_fill_mode`: free | all_required | auto_fill_remaining
String defaultBonusModeKey(OrdersConfig orders) {
  switch (orders.bonusFillMode) {
    case 'all_required':
      return 'auto';
    case 'free':
      return 'none';
    case 'auto_fill_remaining':
      return 'auto';
    default:
      return 'auto';
  }
}

bool isBonusModeKeyAllowed(OrdersConfig orders, String modeKey) {
  switch (orders.bonusFillMode) {
    case 'all_required':
      return modeKey == 'auto';
    case 'free':
      return modeKey == 'none';
    default:
      return true;
  }
}

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
