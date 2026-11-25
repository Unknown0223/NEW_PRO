import 'package:flutter/services.dart' show appFlavor;

/// TezYuk vs SalesDoc product surface (flavor / dart-define).
enum AppProduct { salesdoc, tezyuk }

/// Parses `APP_PRODUCT` / flavor string. Unknown → [AppProduct.salesdoc].
AppProduct parseAppProduct(String? raw) {
  final v = (raw ?? '').trim().toLowerCase();
  if (v == 'tezyuk') return AppProduct.tezyuk;
  return AppProduct.salesdoc;
}

/// TezYuk APK: faqat ekspeditor.
bool tezyukAllowsRole(String role) {
  return role.trim().toLowerCase() == 'expeditor';
}

bool productAllowsRole(AppProduct product, String role) {
  if (product == AppProduct.salesdoc) return true;
  return tezyukAllowsRole(role);
}

/// Compile-time product from `--dart-define=APP_PRODUCT=...`.
const String kAppProductDefine = String.fromEnvironment(
  'APP_PRODUCT',
  defaultValue: 'salesdoc',
);

/// Effective product: dart-define **or** Flutter `--flavor` (`appFlavor`).
/// So `flutter run --flavor tezyuk` alone enables TezYuk gate/theme.
AppProduct get currentAppProduct {
  if (parseAppProduct(kAppProductDefine) == AppProduct.tezyuk) {
    return AppProduct.tezyuk;
  }
  return parseAppProduct(appFlavor);
}

bool get isTezyukProduct => currentAppProduct == AppProduct.tezyuk;
