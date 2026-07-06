import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/dio_client.dart';

const _enabledKey = 'biometric_quick_login_enabled';
const _declinedKey = 'biometric_offer_declined';
const _pendingOfferKey = 'biometric_pending_offer';
const _offerShownKey = 'biometric_offer_shown';

/// Telefonda saqlanadigan tez kirish (barmoq izi / Face ID) — serverga yuborilmaydi.
class BiometricPreferences {
  final FlutterSecureStorage _storage;

  BiometricPreferences(this._storage);

  Future<bool> isEnabled() async {
    final v = await _storage.read(key: _enabledKey);
    if (v == '1') return true;
    // Eski versiya kaliti
    final legacy = await _storage.read(key: 'biometric_lock_enabled');
    return legacy == '1';
  }

  Future<void> setEnabled(bool enabled) async {
    if (enabled) {
      await _storage.write(key: _enabledKey, value: '1');
      await _storage.delete(key: _declinedKey);
      await _storage.delete(key: 'biometric_lock_enabled');
    } else {
      await _storage.delete(key: _enabledKey);
      await _storage.delete(key: 'biometric_lock_enabled');
    }
  }

  Future<bool> wasOfferDeclined() async {
    final v = await _storage.read(key: _declinedKey);
    return v == '1';
  }

  Future<void> setOfferDeclined(bool declined) async {
    if (declined) {
      await _storage.write(key: _declinedKey, value: '1');
      await clearPendingOffer();
    } else {
      await _storage.delete(key: _declinedKey);
    }
  }

  Future<bool> hasPendingOffer() async {
    return await _storage.read(key: _pendingOfferKey) == '1';
  }

  Future<void> setPendingOffer(bool pending) async {
    if (pending) {
      await _storage.write(key: _pendingOfferKey, value: '1');
    } else {
      await clearPendingOffer();
    }
  }

  Future<void> clearPendingOffer() async {
    await _storage.delete(key: _pendingOfferKey);
  }

  Future<bool> wasOfferShown() async {
    return await _storage.read(key: _offerShownKey) == '1';
  }

  Future<void> setOfferShown() async {
    await _storage.write(key: _offerShownKey, value: '1');
    await clearPendingOffer();
  }

  /// Dialog ko‘rsatilmagan, lekin «shown» belgilangan holatlarni tiklaydi.
  Future<void> repairOfferState() async {
    if (await isEnabled() || await wasOfferDeclined()) {
      await clearPendingOffer();
      return;
    }
    if (await wasOfferShown() && !await isEnabled()) {
      await _storage.delete(key: _offerShownKey);
    }
  }
}

final biometricPreferencesProvider = Provider<BiometricPreferences>((ref) {
  return BiometricPreferences(ref.read(secureStorageProvider));
});
