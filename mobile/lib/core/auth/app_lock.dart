import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Kamera / galereya kabi ilova ichidagi tizim oynalari fon rejimiga o‘tganda
/// PIN qulfi keraksiz ishga tushmasligi uchun hisoblagich.
class AppLockSuppressionNotifier extends StateNotifier<int> {
  AppLockSuppressionNotifier() : super(0);

  bool get isSuppressed => state > 0;

  void begin() => state = state + 1;

  void end() {
    if (state > 0) state = state - 1;
  }
}

final appLockSuppressionProvider =
    StateNotifierProvider<AppLockSuppressionNotifier, int>((ref) {
  return AppLockSuppressionNotifier();
});

/// Tizim kamerasi yoki galereyasi ochilganda qulflashni vaqtincha o‘chirish.
Future<T?> withAppLockSuppressed<T>(WidgetRef ref, Future<T?> Function() action) async {
  final suppression = ref.read(appLockSuppressionProvider.notifier);
  suppression.begin();
  try {
    return await action();
  } finally {
    suppression.end();
  }
}

Future<T?> withAppLockSuppressedRef<T>(Ref ref, Future<T?> Function() action) async {
  final suppression = ref.read(appLockSuppressionProvider.notifier);
  suppression.begin();
  try {
    return await action();
  } finally {
    suppression.end();
  }
}
