import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/features/expeditor/config/expeditor_config_enforcement.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';

void main() {
  group('ExpeditorConfigPolicy', () {
    test('payments disabled when accept_payment_for_order off', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        const MobileConfig(
          expeditor: ExpeditorConfig(acceptPaymentForOrder: false),
        ),
      );
      expect(policy.paymentsEnabled, isFalse);
    });

    test('payments disabled when both delivery flags off', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        const MobileConfig(
          expeditor: ExpeditorConfig(
            acceptPaymentForOrder: true,
            acceptPaymentOnDelivery: false,
            acceptPaymentFromDebtors: false,
          ),
        ),
      );
      expect(policy.paymentsEnabled, isFalse);
      expect(policy.blockPaymentMessage(), isNotEmpty);
    });

    test('returns enabled when partial return allowed', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        const MobileConfig(
          orders: OrdersConfig(allowPartialReturnEdit: true),
        ),
      );
      expect(policy.returnsEnabled, isTrue);
      expect(policy.allowPartialReturn, isTrue);
    });

    test('shelf return off by default', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(const MobileConfig());
      expect(policy.allowReturnFromShelf, isFalse);
    });

    test('can submit payment on delivery when enabled', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        const MobileConfig(
          expeditor: ExpeditorConfig(
            acceptPaymentForOrder: true,
            acceptPaymentOnDelivery: true,
          ),
        ),
      );
      expect(policy.canSubmitPayment(fromDebtor: false), isTrue);
    });

    test('fingerprint required when config enabled', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        const MobileConfig(
          expeditor: ExpeditorConfig(fingerprintRequiredForShipmentConfirm: true),
        ),
      );
      expect(policy.fingerprintRequired, isTrue);
    });

    test('can change client location when config enabled', () {
      final policy = ExpeditorConfigPolicy.fromMobileConfig(
        const MobileConfig(
          client: ClientConfig(canChangeClientLocation: true),
        ),
      );
      expect(policy.canChangeClientLocation, isTrue);
    });
  });
}
