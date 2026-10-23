import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/notifications/mobile_local_notification_service.dart';
import '../../features/auth/auth_provider.dart';
import '../../routing/app_router.dart';
import 'app_update_dialog.dart';
import 'app_update_info.dart';

/// Login/bootstrap va sinхрон tugagach versiya dialogi + bildirishnoma.
/// Bir vaqtda faqat bitta yangilash oynasi (ustma-ust ochilmasin).
class AppUpdateListener extends ConsumerStatefulWidget {
  final Widget child;

  const AppUpdateListener({super.key, required this.child});

  @override
  ConsumerState<AppUpdateListener> createState() => _AppUpdateListenerState();
}

class _AppUpdateListenerState extends ConsumerState<AppUpdateListener>
    with WidgetsBindingObserver {
  /// Sync flag — postFrame dan oldin qo‘yiladi (race yo‘q).
  bool _dialogLocked = false;
  AppUpdateInfo? _lockedFor;

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
    // Dialog allaqachon ochiq — qayta ochilmasin.
    if (_dialogLocked || isAppUpdateDialogInFlight) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _dialogLocked || isAppUpdateDialogInFlight) return;
      ref.read(authStateProvider.notifier).openAppUpdateFromNotification();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (!mounted) return;
        if (_dialogLocked || isAppUpdateDialogInFlight) return;
        await ref.read(authStateProvider.notifier).resumeDeferredAppUpdate();
      });
    }
  }

  void _scheduleDialog(AppUpdateInfo info, {required bool afterSync}) {
    if (_dialogLocked || isAppUpdateDialogInFlight) return;
    if (_lockedFor == info) return;

    // Sync band qilish — bir nechta listen / postFrame race’ini to‘xtatadi.
    _dialogLocked = true;
    _lockedFor = info;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) {
        _dialogLocked = false;
        _lockedFor = null;
        return;
      }
      var proceed = !info.required;
      try {
        proceed = await showAppUpdateDialog(
          info,
          blocking: info.required,
          afterSync: afterSync,
        );
      } finally {
        _dialogLocked = false;
        _lockedFor = null;
      }

      if (!mounted) return;
      ref.read(authStateProvider.notifier).resolveAppUpdateGate(proceed: proceed);
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      final info = next.pendingAppUpdate;
      if (info == null || !info.hasAction) return;
      if (prev?.pendingAppUpdate == info) return;
      _scheduleDialog(info, afterSync: next.appUpdateAfterSync);
    });

    return widget.child;
  }
}
