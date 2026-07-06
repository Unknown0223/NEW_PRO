import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/agent_action_guards.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';

void main() {
  group('checkMandatorySyncBlock', () {
    test('returns null when not required', () {
      expect(
        checkMandatorySyncBlock(sync: const SyncConfig(), syncCountToday: 0),
        isNull,
      );
    });

    test('blocks when count below required', () {
      final block = checkMandatorySyncBlock(
        sync: const SyncConfig(mandatorySyncCount: 2),
        syncCountToday: 1,
      );
      expect(block, isNotNull);
      expect(block!.message, contains('1 из 2'));
    });
  });

  group('checkBatteryBlock', () {
    test('blocks low battery', () {
      final block = checkBatteryBlock(
        gps: const GpsConfig(minBatteryPct: 20),
        batteryLevelPct: 15,
      );
      expect(block, isNotNull);
      expect(block!.message, contains('15%'));
    });

    test('allows when above minimum', () {
      expect(
        checkBatteryBlock(
          gps: const GpsConfig(minBatteryPct: 20),
          batteryLevelPct: 25,
        ),
        isNull,
      );
    });
  });
}
