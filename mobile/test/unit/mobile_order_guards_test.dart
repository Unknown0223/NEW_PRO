import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/mobile_order_guards.dart';

void main() {
  group('mobile_order_guards', () {
    test('checkShipmentDateRequired when off', () {
      const misc = MiscConfig(requireShipmentDate: false);
      expect(checkShipmentDateRequired(misc, null).allowed, isTrue);
    });

    test('checkShipmentDateRequired when on and empty', () {
      const misc = MiscConfig(requireShipmentDate: true);
      expect(checkShipmentDateRequired(misc, '').allowed, isFalse);
    });

    test('checkStockSnapshotRequired when on without snapshot', () {
      const misc = MiscConfig(requireStockSnapshotForOrder: true);
      expect(checkStockSnapshotRequired(misc, hasSnapshotToday: false).allowed, isFalse);
    });

    test('isStockSnapshotFresh today', () {
      final now = DateTime.now();
      final key = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      expect(isStockSnapshotFresh(key), isTrue);
      expect(isStockSnapshotFresh('2020-01-01'), isFalse);
    });
  });
}
