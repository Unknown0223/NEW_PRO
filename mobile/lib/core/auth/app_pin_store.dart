import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/dio_client.dart';

const _hashKey = 'app_pin_hash';
const _saltKey = 'app_pin_salt';

/// Mahalliy ilova paroli (PIN) — faqat telefonda, serverga yuborilmaydi.
class AppPinStore {
  final FlutterSecureStorage _storage;
  String? _cachedSalt;
  String? _cachedHash;

  AppPinStore(this._storage);

  Future<void> warmCache() async {
    if (_cachedSalt != null && _cachedHash != null) return;
    final results = await Future.wait([
      _storage.read(key: _saltKey),
      _storage.read(key: _hashKey),
    ]);
    _cachedSalt = results[0];
    _cachedHash = results[1];
  }

  Future<bool> isSet() async {
    await warmCache();
    return _cachedHash != null && _cachedHash!.isNotEmpty;
  }

  Future<void> setPin(String pin) async {
    final salt = _randomSalt();
    final hash = _hashPin(pin, salt);
    _cachedSalt = salt;
    _cachedHash = hash;
    await Future.wait([
      _storage.write(key: _saltKey, value: salt),
      _storage.write(key: _hashKey, value: hash),
    ]);
  }

  Future<bool> verifyPin(String pin) async {
    await warmCache();
    final salt = _cachedSalt;
    final stored = _cachedHash;
    if (salt == null || stored == null || salt.isEmpty || stored.isEmpty) {
      return false;
    }
    return _hashPin(pin, salt) == stored;
  }

  Future<void> clear() async {
    _cachedSalt = null;
    _cachedHash = null;
    await Future.wait([
      _storage.delete(key: _hashKey),
      _storage.delete(key: _saltKey),
    ]);
  }

  String _hashPin(String pin, String salt) {
    final bytes = utf8.encode('$salt:$pin');
    return sha256.convert(bytes).toString();
  }

  String _randomSalt() {
    final r = Random.secure();
    final buf = List<int>.generate(16, (_) => r.nextInt(256));
    return base64UrlEncode(buf);
  }
}

final appPinStoreProvider = Provider<AppPinStore>((ref) {
  return AppPinStore(ref.read(secureStorageProvider));
});
