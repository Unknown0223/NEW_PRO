import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Debug → `.env.local`, release → `.env.production`.
/// Dart-define: `--dart-define=APP_ENV=local|production`
Future<void> loadAppEnv() async {
  final file = _resolveEnvFileName();
  try {
    await dotenv.load(fileName: file);
    debugPrint('[SalesDoc] muhit: $file → ${dotenv.env['API_BASE_URL']}');
    return;
  } catch (_) {}

  try {
    await dotenv.load(fileName: '.env');
    debugPrint('[SalesDoc] muhit: .env (zaxira) → ${dotenv.env['API_BASE_URL']}');
  } catch (e) {
    debugPrint('[SalesDoc] env yuklanmadi: $e');
  }
}

String _resolveEnvFileName() {
  const override = String.fromEnvironment('APP_ENV');
  if (override == 'production') return '.env.production';
  if (override == 'local') return '.env.local';
  return kReleaseMode ? '.env.production' : '.env.local';
}
