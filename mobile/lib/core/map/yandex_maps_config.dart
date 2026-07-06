import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Yandex Maps **JavaScript API** kaliti (Static API kaliti ishlamaydi).
String? resolveYandexMapsJsApiKey() {
  final noKey = dotenv.env['YANDEX_MAPS_NO_API_KEY']?.trim().toLowerCase();
  if (noKey == '1' || noKey == 'true') return null;

  final raw = dotenv.env['YANDEX_MAPS_API_KEY']?.trim();
  if (raw == null || raw.isEmpty || raw == 'undefined' || raw == 'null' || raw.length < 10) {
    return null;
  }
  return raw;
}

bool get yandexMapsForceKeyless => resolveYandexMapsJsApiKey() == null;
