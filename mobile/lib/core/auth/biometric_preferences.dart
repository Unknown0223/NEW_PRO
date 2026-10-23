import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/dio_client.dart';
import 'secure_store.dart';

const _enabledKey = 'biometric_quick_login_enabled';
const _declinedKey = 'biometric_offer_declined';
const _pendingOfferKey = 'biometric_pending_offer';
const _offerShownKey = 'biometric_offer_shown';
const _legacyEnabledKey = 'biometric_lock_enabled';
const _legacyLoginKey = 'biometric_login_enabled';

/// Telefonda saqlanadigan tez kirish (barmoq izi / Face ID) — serverga yuborilmaydi.
class BiometricPreferences {
  final SecureStoreReaderWriter _storage;

  BiometricPreferences(this._storage);

  Future<bool> isEnabled() async {
    final v = await _storage.read(_enabledKey);
    if (v == '1') return true;
    // Eski versiya kalitlari
    if (await _storage.read(_legacyEnabledKey) == '1') return true;
    return await _storage.read(_legacyLoginKey) == '1';
  }

  Future<void> setEnabled(bool enabled) async {
    if (enabled) {
      await _storage.write(_enabledKey, '1');
      await _storage.delete(_declinedKey);
      await _storage.delete(_legacyEnabledKey);
      await _storage.delete(_legacyLoginKey);
    } else {
      await _storage.delete(_enabledKey);
      await _storage.delete(_legacyEnabledKey);
      await _storage.delete(_legacyLoginKey);
    }
  }

  Future<bool> wasOfferDeclined() async {
    final v = await _storage.read(_declinedKey);
    return v == '1';
  }

  Future<void> setOfferDeclined(bool declined) async {
    if (declined) {
      await _storage.write(_declinedKey, '1');
      await clearPendingOffer();
    } else {
      await _storage.delete(_declinedKey);
    }
  }

  Future<bool> hasPendingOffer() async {
    return await _storage.read(_pendingOfferKey) == '1';
  }

  Future<void> setPendingOffer(bool pending) async {
    if (pending) {
      await _storage.write(_pendingOfferKey, '1');
    } else {
      await clearPendingOffer();
    }
  }

  Future<void> clearPendingOffer() async {
    await _storage.delete(_pendingOfferKey);
  }

  Future<bool> wasOfferShown() async {
    return await _storage.read(_offerShownKey) == '1';
  }

  Future<void> setOfferShown() async {
    await _storage.write(_offerShownKey, '1');
    await clearPendingOffer();
  }

  /// Chiqish / akkaunt almashtirish — barcha biometrik sozlamalarini tozalash.
  Future<void> clearAll() async {
    for (final key in [
      _enabledKey,
      _declinedKey,
      _pendingOfferKey,
      _offerShownKey,
      _legacyEnabledKey,
      _legacyLoginKey,
    ]) {
      await _storage.delete(key);
    }
  }

  /// Dialog ko‘rsatilmagan, lekin «shown» belgilangan holatlarni tiklaydi.
  Future<void> repairOfferState() async {
    if (await isEnabled() || await wasOfferDeclined()) {
      await clearPendingOffer();
      return;
    }
    if (await wasOfferShown() && !await isEnabled()) {
      await _storage.delete(_offerShownKey);
    }
  }
}

final biometricPreferencesProvider = Provider<BiometricPreferences>((ref) {
  return BiometricPreferences(FlutterSecureStoreAdapter(ref.read(secureStorageProvider)));
});
