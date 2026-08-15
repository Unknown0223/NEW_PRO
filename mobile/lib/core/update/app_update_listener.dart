import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/notifications/mobile_local_notification_service.dart';
import '../../features/auth/auth_provider.dart';
import '../../routing/app_router.dart';
import 'app_update_dialog.dart';

/// Login/bootstrap va sinхрон tugagach versiya dialogi + bildirishnoma.
class AppUpdateListener extends ConsumerStatefulWidget {
  final Widget child;

  const AppUpdateListener({super.key, required this.child});

  @override
  ConsumerState<AppUpdateListener> createState() => _AppUpdateListenerState();
}

class _AppUpdateListenerState extends ConsumerState<AppUpdateListener>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    MobileLocalNotificationService.instance.onNotificationTap = _onNotificationTap;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (MobileLocalNotificationService.instance.onNotificationTap == _onNotificationTap) {
      MobileLocalNotificationService.instance.onNotificationTap = null;
    }
    super.dispose();
  }

  void _onNotificationTap(String? payload) {
    if (MobileLocalNotificationService.isHeldOrdersPayload(payload)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        rootNavigatorKey.currentContext?.go('/notifications');
      });
      return;
    }
    if (!MobileLocalNotificationService.isAppUpdatePayload(payload)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(authStateProvider.notifier).openAppUpdateFromNotification();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        // Versiya keshini har resume da tozalamaymiz — PackageInfo kechiksa
        // 0.0.0 → soxta majburiy yangilash chiqardi.
        await ref.read(authStateProvider.notifier).resumeDeferredAppUpdate();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      final info = next.pendingAppUpdate;
      if (info == null || !info.hasAction) return;
      if (prev?.pendingAppUpdate == info) return;

      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        final proceed = await showAppUpdateDialog(
          info,
          blocking: info.required,
          afterSync: next.appUpdateAfterSync,
        );

        if (!mounted) return;

        // «Позже» (proceed=true, optional) — qayta bildirishnoma spam qilmasin.
        // Bildirishnoma faqat fon/kechiktirilgan yangilashda yuboriladi.

        ref.read(authStateProvider.notifier).resolveAppUpdateGate(proceed: proceed);
      });
    });

    return widget.child;
  }
}
