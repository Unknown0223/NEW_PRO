import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/client_field_constraints.dart';
import 'package:salesdoc_mobile/core/config/client_field_policy.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';

void main() {
  group('client_field_policy', () {
    test('default visible fields include name phone address', () {
      const cfg = ClientConfig();
      expect(isClientFieldVisible(cfg, 'name'), isTrue);
      expect(isClientFieldVisible(cfg, 'phone'), isTrue);
      expect(isClientFieldVisible(cfg, 'address'), isTrue);
      expect(isClientFieldVisible(cfg, 'inn'), isFalse);
    });

    test('phone prefix normalization', () {
      const cfg = ClientConfig(phonePrefix: '+998');
      expect(normalizePhoneWithPrefix(cfg, '901234567'), '+998901234567');
    });

    test('blocks order for inactive new client when config disallows', () {
      const cfg = ClientConfig();
      const product = ProductListConfig(allowSubmitForNewClient: false);
      expect(isNewClientBlockedForOrder({'is_active': 0}, cfg, product), isTrue);
      expect(isNewClientBlockedForOrder({'is_active': 1}, cfg, product), isFalse);
    });

    test('clientFormFieldKeys respects fields_visible', () {
      const cfg = ClientConfig(fieldsVisible: {'name': true, 'inn': true, 'bank': true});
      expect(clientFormFieldKeys(cfg), ['name', 'inn', 'bank']);
    });
  });

  group('client_field_constraints', () {
    test('rejects letters in phone', () {
      expect(validateClientFieldValue('phone', 'abc', required: true), isNotNull);
      expect(validateClientFieldValue('phone', '901234567', required: true), isNull);
    });

    test('inn requires 9 digits', () {
      expect(validateClientFieldValue('inn', '12345', required: true), isNotNull);
      expect(validateClientFieldValue('inn', '123456789', required: true), isNull);
    });

    test('visit_day accepts weekday labels', () {
      expect(validateClientFieldValue('visit_day', '', required: true), isNotNull);
      expect(validateClientFieldValue('visit_day', 'ПН, СР, ПТ', required: true), isNull);
    });
  });
}
