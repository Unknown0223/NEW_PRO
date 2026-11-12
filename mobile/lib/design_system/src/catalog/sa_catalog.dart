import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show Color;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;

/// Saqlagich interfeysi — ilova o'zi beradi (masalan shared_preferences).
/// Bermasa xotirada saqlanadi, ilova yopilganda unutiladi.
abstract class SaCatalogStore {
  Future<String?> read();
  Future<void> write(String raw);
}

class _MemoryStore implements SaCatalogStore {
  String? _v;
  @override
  Future<String?> read() async => _v;
  @override
  Future<void> write(String raw) async {
    _v = raw;
  }
}

/// Dizayn katalogi: ranglar va bayroqlar, versiya bilan.
/// Katalog yangilanganda KOD O'ZGARMAYDI — faqat JSON keladi.
class SaCatalog extends ChangeNotifier {
  SaCatalog._(this.version, this._raw);

  /// Paket ichidagi boshlang'ich katalog.
  factory SaCatalog.fallback() {
    return SaCatalog._('1.0.0', const <String, dynamic>{});
  }

  factory SaCatalog.fromJson(Map<String, dynamic> json) {
    return SaCatalog._(
      (json['version'] ?? '1.0.0').toString(),
      Map<String, dynamic>.from(json),
    );
  }

  final String version;
  final Map<String, dynamic> _raw;

  static const String assetPath = 'assets/design/catalog.json';

  /// Aktivdagi katalogni o'qiydi (har doim bor — fallback).
  static Future<SaCatalog> loadBundled() async {
    try {
      final raw = await rootBundle.loadString(assetPath);
      return SaCatalog.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return SaCatalog.fallback();
    }
  }

  /// Masofadagi katalogni tekshiradi. Yangi versiya bo'lsa yuklab,
  /// saqlaydi va true qaytaradi. Xatoda false — ilova to'xtamaydi.
  Future<bool> checkForUpdate({
    required String baseUrl,
    SaCatalogStore? store,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    final effective = store ?? _MemoryStore();
    try {
      final client = HttpClient();
      client.connectionTimeout = timeout;
      final req = await client.getUrl(Uri.parse(baseUrl + '/catalog.json'));
      final res = await req.close().timeout(timeout);
      if (res.statusCode != 200) return false;
      final body = await res.transform(utf8.decoder).join();
      final json = Map<String, dynamic>.from(jsonDecode(body) as Map);
      final next = SaCatalog.fromJson(json);
      if (!_isNewer(next.version, version)) return false;
      await effective.write(body);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Saqlangan katalogni tiklaydi (kesh).
  static Future<SaCatalog> loadCached(SaCatalogStore store) async {
    try {
      final raw = await store.read();
      if (raw == null) return SaCatalog.fallback();
      return SaCatalog.fromJson(
        Map<String, dynamic>.from(jsonDecode(raw) as Map),
      );
    } catch (_) {
      return SaCatalog.fallback();
    }
  }

  /// '1.2.0' > '1.1.9' kabi solishtiradi.
  static bool _isNewer(String a, String b) {
    List<int> p(String v) =>
        v.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final x = p(a), y = p(b);
    for (var i = 0; i < 3; i++) {
      final dx = i < x.length ? x[i] : 0;
      final dy = i < y.length ? y[i] : 0;
      if (dx != dy) return dx > dy;
    }
    return false;
  }

  /// Rangni o'qiydi, topilmasa token qaytadi.
  int colorHex(String key, int fallback) {
    final colors = _raw['colors'];
    if (colors is Map && colors[key] is String) {
      final hex = (colors[key] as String).replaceAll('#', '');
      return int.tryParse('FF' + hex, radix: 16) ?? fallback;
    }
    return fallback;
  }

  bool flag(String key, bool fallback) {
    final flags = _raw['flags'];
    if (flags is Map && flags[key] is bool) return flags[key] as bool;
    return fallback;
  }

  SaResolvedColors resolve() {
    return SaResolvedColors(
      salesBlue: Color(colorHex('salesBlue', 0xFF1F66D1)),
      brightSky: Color(colorHex('brightSky', 0xFF6FA8FF)),
    );
  }
}

class SaResolvedColors {
  final Color salesBlue;
  final Color brightSky;
  const SaResolvedColors({required this.salesBlue, required this.brightSky});
}
