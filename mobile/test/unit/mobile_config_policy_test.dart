import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/config/mobile_config_policy.dart';

void main() {
  group('isSyncAllowedNow', () {
    test('only allowed_window_to 16:00 — before and at 16:00 allowed', () {
      const sync = SyncConfig(allowedWindowTo: '16:00');
      expect(isSyncAllowedNowAt(sync, hour: 15, minute: 59), isTrue);
      expect(isSyncAllowedNowAt(sync, hour: 16, minute: 0), isTrue);
    });

    test('only allowed_window_to 16:00 — after 16:00 denied', () {
      const sync = SyncConfig(allowedWindowTo: '16:00');
      expect(isSyncAllowedNowAt(sync, hour: 16, minute: 1), isFalse);
      expect(isSyncAllowedNowAt(sync, hour: 20, minute: 0), isFalse);
    });

    test('window from 08:00 to 17:30 — midday allowed', () {
      const sync = SyncConfig(allowedWindowFrom: '08:00', allowedWindowTo: '17:30');
      expect(isSyncAllowedNowAt(sync, hour: 12, minute: 40), isTrue);
      expect(isSyncAllowedNowAt(sync, hour: 17, minute: 31), isFalse);
    });

    test('window from 08:00 to 16:00 — boundaries inclusive', () {
      const sync = SyncConfig(allowedWindowFrom: '08:00', allowedWindowTo: '16:00');
      expect(isSyncAllowedNowAt(sync, hour: 7, minute: 59), isFalse);
      expect(isSyncAllowedNowAt(sync, hour: 8, minute: 0), isTrue);
      expect(isSyncAllowedNowAt(sync, hour: 16, minute: 0), isTrue);
      expect(isSyncAllowedNowAt(sync, hour: 16, minute: 1), isFalse);
    });
  });

  group('evaluateSyncPolicy', () {
    test('block_sync denies before window check', () {
      const sync = SyncConfig(
        blockSync: true,
        allowedWindowTo: '16:00',
      );
      final r = evaluateSyncPolicy(sync);
      expect(r.allowed, isFalse);
      expect(r.denialMessage, contains('bloklangan'));
    });

    test('outside window returns syncWindowMessage', () {
      const sync = SyncConfig(allowedWindowTo: '16:00');
      final r = evaluateSyncPolicyAt(sync, hour: 17, minute: 0);
      expect(r.allowed, isFalse);
      expect(r.denialMessage, syncWindowMessage(sync));
    });
  });
}

bool isSyncAllowedNowAt(SyncConfig sync, {required int hour, required int minute}) {
  final now = DateTime(2026, 6, 1, hour, minute);
  return isSyncAllowedNow(sync, now);
}

SyncPolicyEvaluation evaluateSyncPolicyAt(SyncConfig sync, {required int hour, required int minute}) {
  final now = DateTime(2026, 6, 1, hour, minute);
  if (sync.blockSync) {
    return const SyncPolicyEvaluation(
      allowed: false,
      denialMessage: 'Sinxronizatsiya bloklangan',
    );
  }
  if (!isSyncAllowedNowForDateTime(sync, now)) {
    return SyncPolicyEvaluation(allowed: false, denialMessage: syncWindowMessage(sync));
  }
  return SyncPolicyEvaluation.allowedNow;
}

/// Test helper — production uses [DateTime.now].
bool isSyncAllowedNowForDateTime(SyncConfig sync, DateTime now) {
  final from = sync.allowedWindowFrom?.trim();
  final to = sync.allowedWindowTo?.trim();
  if ((from == null || from.isEmpty) && (to == null || to.isEmpty)) {
    return true;
  }
  final minutes = now.hour * 60 + now.minute;
  int? parseHm(String hm) {
    final p = hm.split(':');
    if (p.length < 2) return null;
    final h = int.tryParse(p[0]);
    final m = int.tryParse(p[1]);
    if (h == null || m == null) return null;
    return h * 60 + m;
  }

  final fromM = from != null && from.isNotEmpty ? parseHm(from) : null;
  final toM = to != null && to.isNotEmpty ? parseHm(to) : null;
  if (fromM == null && toM == null) return true;
  if (fromM != null && toM != null) {
    if (fromM <= toM) return minutes >= fromM && minutes <= toM;
    return minutes >= fromM || minutes <= toM;
  }
  if (fromM != null) return minutes >= fromM;
  return minutes <= (toM ?? 24 * 60);
}
