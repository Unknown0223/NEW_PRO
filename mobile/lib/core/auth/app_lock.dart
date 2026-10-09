import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';

/// Kamera / galereya kabi tizim oynalari ochilganda PIN qulfini vaqtincha o‘chirish.
///
/// Ikki qatlam:
/// 1) Xotira hisoblagich — jarayon tirik bo‘lsa `MobileSessionGuard` qulf qo‘ymaydi.
/// 2) Disk bayroq — Android kamera Activity paytida process o‘lsa, cold start
///    `checkSession` yana PIN so‘ramasligi uchun (TTL ichida).
const _skipLockMetaKey = 'app_lock_skip_after_ext_capture_until';

class AppLockSuppressionNotifier extends StateNotifier<int> {
  AppLockSuppressionNotifier() : super(0);

  bool get isSuppressed => state > 0;

  /// `paused` suppressed holatda bo‘lgan; `end()` resume’dan oldin chaqirilsa ham
  /// keyingi `resumed`da qulf qo‘yilmasin.
  bool skipNextResumeLock = false;

  void begin() => state = state + 1;

  void end() {
    if (state > 0) state = state - 1;
  }
}

final appLockSuppressionProvider =
    StateNotifierProvider<AppLockSuppressionNotifier, int>((ref) {
  return AppLockSuppressionNotifier();
});

Future<void> markExternalCaptureSkipLock({
  Duration ttl = const Duration(minutes: 2),
}) async {
  final until = DateTime.now().toUtc().add(ttl).toIso8601String();
  await AppDatabase().setSyncMeta(_skipLockMetaKey, until);
}

Future<void> clearExternalCaptureSkipLock() async {
  await AppDatabase().setSyncMeta(_skipLockMetaKey, '');
}

/// Diskdagi TTL qiymati hali amal qiladimi (unit-test uchun sof funksiya).
bool isExternalCaptureSkipLockValid(String? raw, {DateTime? now}) {
  if (raw == null || raw.isEmpty) return false;
  final until = DateTime.tryParse(raw)?.toUtc();
  if (until == null) return false;
  return (now ?? DateTime.now()).toUtc().isBefore(until);
}

/// Cold start: kamera Activity dan qaytishda process o‘lgan bo‘lsa PIN o‘tkazib yuborish.
Future<bool> consumeExternalCaptureSkipLock() async {
  final raw = await AppDatabase().getSyncMeta(_skipLockMetaKey);
  await clearExternalCaptureSkipLock();
  return isExternalCaptureSkipLockValid(raw);
}

Future<void> _waitUntilResumed({
  Duration timeout = const Duration(seconds: 3),
}) async {
  final binding = WidgetsBinding.instance;
  final current = binding.lifecycleState;
  if (current == null || current == AppLifecycleState.resumed) return;

  final done = Completer<void>();
  late final WidgetsBindingObserver observer;
  observer = _ResumeObserver(() {
    if (!done.isCompleted) done.complete();
  });
  binding.addObserver(observer);
  try {
    await done.future.timeout(timeout, onTimeout: () {});
  } finally {
    binding.removeObserver(observer);
  }
}

class _ResumeObserver with WidgetsBindingObserver {
  _ResumeObserver(this.onResumed);
  final void Function() onResumed;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) onResumed();
  }
}

/// Tizim kamerasi / galereya ochilganda qulflashni vaqtincha o‘chirish.
///
/// Disk bayroqni `finally`da o‘chirmaymiz: kamera qaytgach siqish/upload paytida
/// Android processni o‘ldirsa, cold start hali PIN o‘tkaza oladi (TTL ichida).
Future<T?> withAppLockSuppressed<T>(
  WidgetRef ref,
  Future<T?> Function() action, {
  Duration ttl = const Duration(minutes: 5),
}) async {
  final suppression = ref.read(appLockSuppressionProvider.notifier);
  await markExternalCaptureSkipLock(ttl: ttl);
  suppression.begin();
  try {
    return await action();
  } finally {
    // pickImage Future ba’zan `resumed` lifecycle’dan oldin tugaydi.
    await _waitUntilResumed();
    suppression.skipNextResumeLock = true;
    suppression.end();
    // Encode/upload OOM oynasi uchun TTL ni yangilab qo‘yamiz (clear qilmaymiz).
    await markExternalCaptureSkipLock(ttl: ttl);
  }
}

Future<T?> withAppLockSuppressedRef<T>(
  Ref ref,
  Future<T?> Function() action, {
  Duration ttl = const Duration(minutes: 5),
}) async {
  final suppression = ref.read(appLockSuppressionProvider.notifier);
  await markExternalCaptureSkipLock(ttl: ttl);
  suppression.begin();
  try {
    return await action();
  } finally {
    await _waitUntilResumed();
    suppression.skipNextResumeLock = true;
    suppression.end();
    await markExternalCaptureSkipLock(ttl: ttl);
  }
}
