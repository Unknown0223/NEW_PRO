import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Minimal secure storage surface for unit tests and adapters.
abstract class SecureStoreReaderWriter {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureStoreAdapter implements SecureStoreReaderWriter {
  FlutterSecureStoreAdapter(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<void> delete(String key) => _storage.delete(key: key);

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) => _storage.write(key: key, value: value);
}
