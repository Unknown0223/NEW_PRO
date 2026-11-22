import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/mobile_config_policy.dart';
import 'package:salesdoc_mobile/features/agent/sync/manual_sync_provider.dart';

void main() {
  group('sync policy + manual sync container', () {
    test('syncWindowMessage includes work-region clock hint', () {
      const sync = SyncConfig(
        allowedWindowFrom: '01:00',
        allowedWindowTo: '17:30',
      );
      final msg = syncWindowMessage(sync);
      expect(msg, contains('01:00'));
      expect(msg, contains('17:30'));
      expect(msg, contains('сейчас'));
      expect(msg, contains('рабочий регион'));
    });

    test('buildSyncWindowDeniedInfo — chiroyli banner matnlari', () {
      const sync = SyncConfig(
        allowedWindowFrom: '06:00',
        allowedWindowTo: '22:00',
      );
      final info = buildSyncWindowDeniedInfo(sync, slotCode: 'A-MAIN-001');
      expect(info.title, contains('недоступна'));
      expect(info.windowLine, contains('06:00'));
      expect(info.windowLine, contains('22:00'));
      expect(info.slotLine, 'Слот: A-MAIN-001');
      expect(info.hint, contains('Рабочее место'));
      expect(info.summaryLine, contains('A-MAIN-001'));
    });

    test('isOutsideSyncWindowDenial — block_sync uchun false', () {
      const blocked = SyncConfig(
        blockSync: true,
        allowedWindowFrom: '06:00',
        allowedWindowTo: '22:00',
      );
      expect(isOutsideSyncWindowDenial(blocked), isFalse);
    });

    test('outside 01:00–17:30 at 20:33 is denied', () {
      const sync = SyncConfig(
        allowedWindowFrom: '01:00',
        allowedWindowTo: '17:30',
      );
      expect(isSyncAllowedNow(sync, DateTime(2026, 8, 30, 20, 33)), isFalse);
      expect(isSyncAllowedNow(sync, DateTime(2026, 8, 30, 15, 0)), isTrue);
      expect(isSyncAllowedNow(sync, DateTime(2026, 8, 30, 17, 30)), isTrue);
      expect(isSyncAllowedNow(sync, DateTime(2026, 8, 30, 17, 31)), isFalse);
    });

    test('ProviderContainer can read manualSyncProvider after sheet-like dispose pattern', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(manualSyncProvider).status, ManualSyncStatus.idle);
      expect(container.read(manualSyncProvider.notifier).isRunning, isFalse);

      // Sheet dispose qilganda WidgetRef o‘lik — container esa yashaydi.
      final notifier = container.read(manualSyncProvider.notifier);
      expect(notifier, isNotNull);
    });

    test('06:00–22:00 allows evening 20:33', () {
      const sync = SyncConfig(
        allowedWindowFrom: '06:00',
        allowedWindowTo: '22:00',
      );
      expect(isSyncAllowedNow(sync, DateTime(2026, 8, 30, 20, 33)), isTrue);
      expect(isSyncAllowedNow(sync, DateTime(2026, 8, 30, 22, 1)), isFalse);
    });
  });
}
