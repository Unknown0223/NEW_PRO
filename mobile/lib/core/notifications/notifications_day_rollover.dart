import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../time/work_region_time.dart';
import 'mobile_local_notification_service.dart';

/// Sync-meta kaliti: oxirgi «bildirishnomalar kuni» (`yyyy-MM-dd`, ish mintaqasi).
const kLastNotificationsDayMetaKey = 'last_notifications_day';

/// Session-local «прочитано» (badge / «Все ✓»). Kun o‘zgaganda tozalanadi.
final notificationsReadIdsProvider = StateProvider<Set<String>>((ref) => {});

String notificationsDayKey([DateTime? reference]) {
  final wr = reference == null ? workRegionNow() : workRegionNow(reference.toUtc());
  return '${wr.year}-${wr.month.toString().padLeft(2, '0')}-${wr.day.toString().padLeft(2, '0')}';
}

/// ISO yoki [DateTime] ish mintaqasidagi kalendar kuni [dayKey] bilan mosmi.
bool isOnNotificationsDay(Object? timestamp, {String? dayKey}) {
  final today = dayKey ?? serverTodayKey();
  if (timestamp == null) return false;
  if (timestamp is DateTime) {
    return notificationsDayKey(timestamp) == today;
  }
  final raw = timestamp.toString().trim();
  if (raw.isEmpty) return false;
  final wr = toWorkRegionFromIso(raw);
  if (wr != null) {
    return '${wr.year}-${wr.month.toString().padLeft(2, '0')}-${wr.day.toString().padLeft(2, '0')}' ==
        today;
  }
  final dt = DateTime.tryParse(raw);
  if (dt == null) return raw.startsWith(today);
  return notificationsDayKey(dt) == today;
}

/// Kun o‘zgarganda: read-state tozalanadi, traydagi kunlik pushlar olib tashlanadi.
/// Held buyurtmalar o‘chirilmaydi — faqat ko‘rinish/read holati.
Future<bool> ensureNotificationsDayRollover(Ref ref) async {
  final today = serverTodayKey();
  final db = AppDatabase();
  final last = await db.getSyncMeta(kLastNotificationsDayMetaKey);
  if (last == today) return false;

  ref.read(notificationsReadIdsProvider.notifier).state = {};
  await MobileLocalNotificationService.instance.clearDayScopedTrayNotifications();
  await db.setSyncMeta(kLastNotificationsDayMetaKey, today);
  return true;
}

/// Keyingi mahalliy (ish mintaqasi) yarim tungacha qolgan vaqt.
Duration durationUntilNextNotificationsMidnight() {
  final now = workRegionNow();
  final next = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
  final left = next.difference(now);
  if (left.inMilliseconds <= 0) return const Duration(seconds: 1);
  return left;
}

/// App resume / notifications page / midnight timer uchun.
final notificationsDayRolloverProvider = Provider<NotificationsDayRolloverController>((ref) {
  final c = NotificationsDayRolloverController(ref);
  ref.onDispose(c.dispose);
  return c;
});

class NotificationsDayRolloverController {
  NotificationsDayRolloverController(this._ref);

  final Ref _ref;
  Timer? _midnightTimer;
  bool _running = false;

  Future<void> checkNow() async {
    if (_running) {
      _scheduleMidnight();
      return;
    }
    _running = true;
    try {
      await ensureNotificationsDayRollover(_ref);
    } finally {
      _running = false;
      _scheduleMidnight();
    }
  }

  void _scheduleMidnight() {
    _midnightTimer?.cancel();
    _midnightTimer = Timer(durationUntilNextNotificationsMidnight(), () {
      unawaited(checkNow());
    });
  }

  void dispose() {
    _midnightTimer?.cancel();
    _midnightTimer = null;
  }
}
