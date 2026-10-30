import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_pin_store.dart';
import 'biometric_service.dart';
import '../../features/auth/pin_confirm_dialog.dart';

/// Muhim amal (to'lov, yetkazish, qaytarish, buyurtma) oldidan Face ID / PIN tasdiq.
class BiometricTransactionConfirm {
  const BiometricTransactionConfirm._();

  static Future<bool> confirm(
    WidgetRef ref, {
    required BuildContext context,
    required bool required,
    required String reason,
  }) async {
    if (!required) return true;

    final bio = ref.read(biometricServiceProvider);
    if (await bio.isAvailable()) {
      return bio.authenticate(reason: reason, biometricOnly: true);
    }

    final pinStore = ref.read(appPinStoreProvider);
    if (await pinStore.isSet()) {
      if (!context.mounted) return false;
      return showPinConfirmDialog(context, ref, title: reason);
    }

    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Подтверждение недоступно: включите Face ID / отпечаток '
            'или установите PIN в профиле',
          ),
        ),
      );
    }
    return false;
  }
}
