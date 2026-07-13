import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/orders_api.dart';
import '../../../core/auth/session.dart';
import '../orders/order_create_models.dart';

/// Menyudan joriy sahifa qayta tanlanganda yangilash (go_router bir xil route qayta yaratmaydi).
final agentRouteReselectProvider = StateProvider<String?>((ref) => null);

/// Tanlangan ombor — null bo‘lsa server birinchi omborni tanlaydi.
final warehouseStockWarehouseIdProvider = StateProvider<int?>((ref) => null);

class WarehouseStockLine {
  final String name;
  final String count;
  final String? priceLabel;
  const WarehouseStockLine({required this.name, required this.count, this.priceLabel});
}

class WarehouseStockCategory {
  final String name;
  final List<WarehouseStockLine> items;
  const WarehouseStockCategory({required this.name, required this.items});
}

class WarehouseStockView {
  final List<Map<String, dynamic>> warehouses;
  final int? warehouseId;
  final List<WarehouseStockCategory> categories;

  const WarehouseStockView({
    required this.warehouses,
    required this.warehouseId,
    required this.categories,
  });

  bool get hasAnyStock => categories.any((c) => c.items.isNotEmpty);
}

String formatStockQty(double v) {
  if (v == v.roundToDouble()) return formatMoneySpaced(v);
  return v.toStringAsFixed(1);
}

WarehouseStockView _parseWarehouseStockView(Map<String, dynamic> raw, int? whOverride) {
  final warehouses = (raw['warehouses'] as List? ?? [])
      .map((e) => Map<String, dynamic>.from(e as Map))
      .toList();
  final whId = (raw['warehouse_id'] as num?)?.toInt() ?? whOverride;
  final categoriesRaw = raw['categories'] as List? ?? [];
  final categories = <WarehouseStockCategory>[];

  for (final cat in categoriesRaw) {
    if (cat is! Map) continue;
    final name = cat['name']?.toString() ?? 'Boshqa';
    final itemsRaw = cat['items'] as List? ?? [];
    final lines = <WarehouseStockLine>[];
    for (final item in itemsRaw) {
      if (item is! Map) continue;
      final available = _parseNum(item['available']);
      if (available <= 0) continue;
      final priceRaw = item['price'];
      String? priceLabel;
      if (priceRaw != null) {
        final priceNum = _parseNum(priceRaw);
        if (priceNum > 0) {
          final currency = item['currency']?.toString().trim();
          priceLabel = formatMoneyUz(priceNum, currency: (currency != null && currency.isNotEmpty) ? currency : 'UZS');
        }
      }
      lines.add(WarehouseStockLine(
        name: item['name']?.toString() ?? '—',
        count: formatStockQty(available),
        priceLabel: priceLabel,
      ),);
    }
    if (lines.isNotEmpty) {
      categories.add(WarehouseStockCategory(name: name, items: lines));
    }
  }

  return WarehouseStockView(
    warehouses: warehouses,
    warehouseId: whId,
    categories: categories,
  );
}

class WarehouseStockNotifier extends AsyncNotifier<WarehouseStockView> {
  static WarehouseStockView? _memoryCache;
  static int? _memoryCacheWh;

  Future<WarehouseStockView> _fetch() async {
    final slug = ref.read(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) {
      throw StateError('Tenant slug yo‘q');
    }
    final whOverride = ref.read(warehouseStockWarehouseIdProvider);
    final raw = await ref.read(ordersApiProvider).getWarehouseStockView(
          slug,
          warehouseId: whOverride,
        );
    final view = _parseWarehouseStockView(raw, whOverride);
    _memoryCache = view;
    _memoryCacheWh = whOverride;
    return view;
  }

  @override
  Future<WarehouseStockView> build() async {
    ref.keepAlive();
    ref.watch(warehouseStockWarehouseIdProvider);

    if (_memoryCache != null && _memoryCacheWh == ref.read(warehouseStockWarehouseIdProvider)) {
      Future(() async {
        try {
          final fresh = await _fetch();
          state = AsyncData(fresh);
        } catch (_) {
          /* eski ma'lumot qoladi */
        }
      });
      return _memoryCache!;
    }

    return _fetch();
  }

  Future<void> refresh({bool force = false}) async {
    if (force) {
      state = const AsyncLoading();
    }
    try {
      final view = await _fetch();
      state = AsyncData(view);
    } catch (e, st) {
      if (force || state.valueOrNull == null) {
        state = AsyncError(e, st);
      }
    }
  }
}

final warehouseStockProvider = AsyncNotifierProvider<WarehouseStockNotifier, WarehouseStockView>(
  WarehouseStockNotifier.new,
);

double _parseNum(dynamic v) {
  if (v is num) return v.toDouble();
  return double.tryParse(v?.toString().replaceAll(',', '.') ?? '') ?? 0;
}
