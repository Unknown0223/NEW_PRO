import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/app_pin_store.dart';
import '../../core/auth/biometric_preferences.dart';
import '../../core/auth/biometric_service.dart';
import 'auth_provider.dart';
import 'biometric_setup_dialog.dart';

/// PIN o‘rnatilgandan va ilova tayyor bo‘lgach biometrik taklifini ko‘rsatadi.
class BiometricSetupListener extends ConsumerStatefulWidget {
  final Widget child;

  const BiometricSetupListener({super.key, required this.child});

  @override
  ConsumerState<BiometricSetupListener> createState() => _BiometricSetupListenerState();
}

class _BiometricSetupListenerState extends ConsumerState<BiometricSetupListener> {
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeOfferSetup());
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<AuthState>(authStateProvider, (prev, next) {
      if (next.status != AuthStatus.ready) return;
      if (prev?.status == AuthStatus.ready) return;
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeOfferSetup());
    });

    return widget.child;
  }

  Future<void> _maybeOfferSetup() async {
    if (_checking || !mounted) return;
    if (ref.read(authStateProvider).status != AuthStatus.ready) return;
    _checking = true;
    try {
      final prefs = ref.read(biometricPreferencesProvider);
      await prefs.repairOfferState();

      if (await prefs.isEnabled() || await prefs.wasOfferDeclined()) {
        await prefs.clearPendingOffer();
        return;
      }
      if (!await ref.read(biometricServiceProvider).isAvailable()) return;
      if (!await ref.read(appPinStoreProvider).isSet()) return;

      final pending = await prefs.hasPendingOffer();
      final neverShown = !await prefs.wasOfferShown();
      if (!pending && !neverShown) return;

      if (!mounted) return;
      await Future<void>.delayed(const Duration(milliseconds: 350));
      if (!mounted) return;
      await showBiometricSetupDialog(context, ref);
      if (!mounted) return;
      await prefs.setOfferShown();
    } finally {
      _checking = false;
    }
  }
}
