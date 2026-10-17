import 'package:flutter_test/flutter_test.dart';

import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/security_config_policy.dart';

void main() {
  group('SecurityConfigPolicy', () {
    test('defaults off', () {
      const policy = SecurityConfigPolicy(MiscConfig());
      expect(policy.confirmOrderSubmit, isFalse);
      expect(policy.confirmPaymentAccept, isFalse);
    });

    test('reads misc flags from json', () {
      final mc = MobileConfig.fromJson({
        'misc': {
          'biometric_confirm_for_order_submit': true,
          'biometric_confirm_for_payment_accept': true,
        },
      });
      final policy = SecurityConfigPolicy.fromMobileConfig(mc);
      expect(policy.confirmOrderSubmit, isTrue);
      expect(policy.confirmPaymentAccept, isTrue);
    });
  });
}
