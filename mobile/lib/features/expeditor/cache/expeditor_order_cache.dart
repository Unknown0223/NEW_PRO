import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Buyurtma tafsiloti va to'lov konteksti — offline ko'rinish uchun.
class ExpeditorOrderCache {
  static const _fileName = 'expeditor_order_cache.json';

  Future<File> _file() async {
    final dir = await getApplicationDocumentsDirectory();
    return File('${dir.path}/$_fileName');
  }

  Future<Map<String, dynamic>> _readAll() async {
    try {
      final f = await _file();
      if (!await f.exists()) return {};
      return jsonDecode(await f.readAsString()) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  Future<void> saveDetail(String slug, int orderId, Map<String, dynamic> detail) async {
    final all = await _readAll();
    if (all['slug']?.toString() != slug) {
      all.clear();
      all['slug'] = slug;
    }
    final details = Map<String, dynamic>.from(all['details'] as Map? ?? {});
    details['$orderId'] = detail;
    all['details'] = details;
    all['saved_at'] = DateTime.now().toUtc().toIso8601String();
    await (await _file()).writeAsString(jsonEncode(all));
  }

  Future<void> savePaymentContext(String slug, int orderId, Map<String, dynamic> ctx) async {
    final all = await _readAll();
    if (all['slug']?.toString() != slug) {
      all.clear();
      all['slug'] = slug;
    }
    final payments = Map<String, dynamic>.from(all['payments'] as Map? ?? {});
    payments['$orderId'] = ctx;
    all['payments'] = payments;
    all['saved_at'] = DateTime.now().toUtc().toIso8601String();
    await (await _file()).writeAsString(jsonEncode(all));
  }

  Future<Map<String, dynamic>?> loadDetail(String slug, int orderId) async {
    final all = await _readAll();
    if (all['slug']?.toString() != slug) return null;
    final details = all['details'] as Map?;
    if (details == null) return null;
    final row = details['$orderId'];
    if (row is! Map) return null;
    return Map<String, dynamic>.from(row);
  }

  Future<Map<String, dynamic>?> loadPaymentContext(String slug, int orderId) async {
    final all = await _readAll();
    if (all['slug']?.toString() != slug) return null;
    final payments = all['payments'] as Map?;
    if (payments == null) return null;
    final row = payments['$orderId'];
    if (row is! Map) return null;
    return Map<String, dynamic>.from(row);
  }

  Future<void> clear() async {
    try {
      final f = await _file();
      if (await f.exists()) await f.delete();
    } catch (_) {}
  }
}
