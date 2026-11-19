import 'package:flutter_dotenv/flutter_dotenv.dart';

import '../api/api_base_url.dart';

/// API muhitini saqlash/tekshirish uchun (lokal vs production aralashmasin).
String resolveApiEnvKey() {
  final raw = resolveApiBaseUrl().trim();
  final uri = Uri.tryParse(raw);
  if (uri == null) return raw.toLowerCase();
  final port = uri.hasPort ? uri.port : (uri.scheme == 'https' ? 443 : 80);
  return '${uri.scheme}://${uri.host.toLowerCase()}:$port';
}

/// Login ekranida oldindan to'ldirish (faqat .env.local da).
String? defaultTenantSlug() {
  final value = dotenv.env['DEFAULT_TENANT_SLUG']?.trim();
  if (value == null || value.isEmpty) return null;
  return value;
}

String? defaultLogin() {
  final value = dotenv.env['DEFAULT_LOGIN']?.trim();
  if (value == null || value.isEmpty) return null;
  return value;
}

bool isLocalApiEnv() {
  final uri = Uri.tryParse(resolveApiBaseUrl());
  if (uri == null) return false;
  final host = uri.host.toLowerCase();
  return host == '127.0.0.1' ||
      host == 'localhost' ||
      host == '10.0.2.2' ||
      host.startsWith('192.168.');
}

/// Login ekranida ko'rsatish: lokal yoki production server.
String apiEnvDisplayLabel() {
  final api = resolveApiBaseUrl();
  if (isLocalApiEnv()) return 'Lokal server · $api';
  return 'Production server · $api';
}
