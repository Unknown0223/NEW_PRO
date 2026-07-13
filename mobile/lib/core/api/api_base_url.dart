import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Emulyatorda `127.0.0.1` → `10.0.2.2`. Haqiqiy telefonda o'zgartirilmaydi.
String? _androidEmulatorHost;

void configureApiHostForAndroidEmulator(bool isEmulator) {
  _androidEmulatorHost = isEmulator ? '10.0.2.2' : null;
}

String resolveApiBaseUrl() {
  var url = dotenv.env['API_BASE_URL'];
  if (url == null || url.isEmpty) {
    url = 'http://127.0.0.1:18080';
  }

  if (!kIsWeb && Platform.isAndroid && _androidEmulatorHost != null) {
    final uri = Uri.tryParse(url);
    if (uri != null) {
      final host = uri.host.toLowerCase();
      if (host == '127.0.0.1' || host == 'localhost') {
        url = uri.replace(host: _androidEmulatorHost!).toString();
      }
    }
  }

  return url;
}
