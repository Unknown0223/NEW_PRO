import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Ekspeditor yetkazishlar — offline ko'rinish uchun oddiy fayl keshi.
class ExpeditorDeliveriesCache {
  static const _fileName = 'expeditor_deliveries_cache.json';

  Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_fileName');
  }

  Future<void> save(String slug, List<Map<String, dynamic>> rows) async {
    final f = await _file();
    final payload = {
      'slug': slug,
      'saved_at': DateTime.now().toUtc().toIso8601String(),
      'rows': rows,
    };
    await f.writeAsString(jsonEncode(payload));
  }

  Future<List<Map<String, dynamic>>?> load(String slug) async {
    try {
      final f = await _file();
      if (!await f.exists()) return null;
      final raw = jsonDecode(await f.readAsString()) as Map<String, dynamic>;
      if (raw['slug']?.toString() != slug) return null;
      final list = raw['rows'] as List?;
      if (list == null) return null;
      return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return null;
    }
  }

  Future<void> clear() async {
    try {
      final f = await _file();
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }
}
