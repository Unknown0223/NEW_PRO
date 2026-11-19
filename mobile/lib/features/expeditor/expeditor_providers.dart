import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/expeditor_api.dart';
import '../../core/auth/session.dart';
import '../../core/connectivity/connectivity_service.dart';
import 'cache/expeditor_deliveries_cache.dart';
import 'cache/expeditor_order_cache.dart';

final _expeditorCache = ExpeditorDeliveriesCache();
final _orderCache = ExpeditorOrderCache();

Future<List<Map<String, dynamic>>> _fetchAllDeliveries(
  Ref ref,
  String slug, {
  String? statusFilter,
}) async {
  final api = ref.read(expeditorApiProvider);
  final all = <Map<String, dynamic>>[];
  var page = 1;
  const limit = 100;
  while (page <= 10) {
    final r = await api.listDeliveries(slug, page: page, limit: limit, status: statusFilter);
    all.addAll(r.data);
    if (r.data.isEmpty || all.length >= r.total) break;
    page++;
  }
  return all;
}

List<Map<String, dynamic>> _filterDeliveriesByStatus(
  List<Map<String, dynamic>> rows,
  String? statusFilter,
) {
  if (statusFilter == null || statusFilter.isEmpty) return rows;
  return rows.where((o) => o['status']?.toString() == statusFilter).toList();
}

Future<List<Map<String, dynamic>>> _loadDeliveries(
  Ref ref,
  String slug, {
  String? statusFilter,
}) async {
  final online = await ref.read(connectivityProvider).isOnline();

  if (online) {
    try {
      final rows = await _fetchAllDeliveries(ref, slug, statusFilter: statusFilter);
      await _expeditorCache.save(slug, rows);
      return rows;
    } catch (_) {
      final cached = await _expeditorCache.load(slug);
      if (cached != null) return _filterDeliveriesByStatus(cached, statusFilter);
      rethrow;
    }
  }

  final cached = await _expeditorCache.load(slug);
  return _filterDeliveriesByStatus(cached ?? [], statusFilter);
}

final expeditorHomeStatsProvider = FutureProvider<Map<String, int>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {'orders': 0, 'pending': 0, 'delivering': 0};
  final deliveries = await _loadDeliveries(ref, slug);
  final delivering = deliveries.where((o) => o['status'] == 'delivering').length;
  return {
    'orders': deliveries.length,
    'pending': deliveries.where((o) => o['status'] != 'delivered').length,
    'delivering': delivering,
  };
});

final deliveriesProvider = FutureProvider.family<List<Map<String, dynamic>>, String?>(
  (ref, statusFilter) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return [];
    return _loadDeliveries(ref, slug, statusFilter: statusFilter);
  },
);

final expeditorOrderDetailProvider = FutureProvider.family<Map<String, dynamic>, int>(
  (ref, orderId) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) throw Exception('Tenant yo\'q');
    final online = await ref.read(connectivityProvider).isOnline();
    if (online) {
      try {
        final detail = await ref.read(expeditorApiProvider).getOrderDetail(slug, orderId);
        await _orderCache.saveDetail(slug, orderId, detail);
        return detail;
      } catch (_) {
        final cached = await _orderCache.loadDetail(slug, orderId);
        if (cached != null) return cached;
        rethrow;
      }
    }
    final cached = await _orderCache.loadDetail(slug, orderId);
    if (cached != null) return cached;
    throw Exception('Offline — buyurtma keshda yo\'q');
  },
);

final expeditorDashboardProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  // Faqat `tenantSlug` o'zgarganda qayta yuklansin — sessiya boshqa maydonlari
  // (mobileConfig, permissions, lastSync...) yangilanganda emas. Aks holda
  // bootstrap paytida sahifa bir necha marta «loading» ga tushib, miltillaydi.
  final slug = ref.watch(sessionProvider.select((s) => s.tenantSlug ?? ''));
  if (slug.isEmpty) return {};
  return ref.read(expeditorApiProvider).getDashboard(slug);
});

final expeditorVisitsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>(
  (ref, tab) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return [];
    return ref.read(expeditorApiProvider).listVisits(slug, tab: tab);
  },
);

final expeditorDebtorsProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(expeditorApiProvider).listDebtors(slug);
});

/// Kassir qaytargan (taymerli) to'lovlar — to'g'rilash uchun.
final expeditorReturnedPaymentsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(expeditorApiProvider).listReturnedPayments(slug);
});

final expeditorClientBalanceDetailProvider =
    FutureProvider.family<Map<String, dynamic>, int>((ref, clientId) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {'total_balance': 0, 'owners': []};
  return ref.read(expeditorApiProvider).getClientBalanceDetail(slug, clientId);
});

/// Mijoz kartasi (Должники → mijoz): sarlavha + to'lov tarixi + qaytarilgan zakazlar.
final expeditorClientDetailProvider =
    FutureProvider.family<Map<String, dynamic>, int>((ref, clientId) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) {
    return {'client': <String, dynamic>{}, 'payments': [], 'returns': []};
  }
  return ref.read(expeditorApiProvider).getClientDetail(slug, clientId);
});

typedef ClientHistoryQuery = ({int clientId, String? from, String? to});

/// История заказов — mijoz zakazlari (sana filtri bilan).
final expeditorClientOrdersProvider =
    FutureProvider.family<List<Map<String, dynamic>>, ClientHistoryQuery>(
        (ref, q) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(expeditorApiProvider).getClientOrders(
        slug,
        q.clientId,
        dateFrom: q.from,
        dateTo: q.to,
      );
});

/// Акт сверки — mijoz ledger (sana filtri bilan).
final expeditorClientLedgerProvider =
    FutureProvider.family<Map<String, dynamic>, ClientHistoryQuery>(
        (ref, q) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {'account_balance': 0, 'rows': [], 'total': 0};
  return ref.read(expeditorApiProvider).getClientLedger(
        slug,
        q.clientId,
        dateFrom: q.from,
        dateTo: q.to,
      );
});

final expeditorPaymentsSummaryProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, groupBy) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return {'mode': groupBy, 'data': []};
    return ref.read(expeditorApiProvider).listPaymentsSummary(slug, groupBy: groupBy);
  },
);

final expeditorShipmentDocsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>(
  (ref, docType) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) return [];
    return ref.read(expeditorApiProvider).listShipmentDocuments(slug, type: docType);
  },
);

final expeditorShipmentDetailProvider = FutureProvider.family<Map<String, dynamic>, String>(
  (ref, docId) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) throw Exception('Tenant yo\'q');
    return ref.read(expeditorApiProvider).getShipmentDocument(slug, docId);
  },
);

final expeditorWarehousesProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(expeditorApiProvider).listWarehouses(slug);
});

/// Mashinadagi qoldiq — skladdan olingan, hali yetkazilmagan mahsulotlar.
final expeditorVehicleStockProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {'products': <Map<String, dynamic>>[], 'totals': <String, dynamic>{}};
  return ref.read(expeditorApiProvider).getVehicleStock(slug);
});

/// «Возврат с полки по заказу» — tanlanadigan zakazlar (balans/davr filtri).
final expeditorReturnByOrderOrdersProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return {'orders': [], 'filter_mode': null};
  return ref.read(expeditorApiProvider).listReturnByOrderOrders(slug);
});

/// Ekspeditor topshiradigan qaytarish hujjatlari + zavsklad qabul holati.
final expeditorMyReturnsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) return [];
  return ref.read(expeditorApiProvider).listMyReturns(slug);
});

/// Bitta zakaz tarkibi — qaytarish uchun mahsulotlar.
final expeditorReturnCompositionProvider =
    FutureProvider.family<Map<String, dynamic>, int>((ref, orderId) async {
  final slug = ref.watch(sessionProvider).tenantSlug ?? '';
  if (slug.isEmpty) throw Exception('Tenant yo\'q');
  return ref.read(expeditorApiProvider).getReturnByOrderComposition(slug, orderId);
});

final expeditorPaymentContextProvider = FutureProvider.family<Map<String, dynamic>, int>(
  (ref, orderId) async {
    final slug = ref.watch(sessionProvider).tenantSlug ?? '';
    if (slug.isEmpty) throw Exception('Tenant yo\'q');
    final online = await ref.read(connectivityProvider).isOnline();
    if (online) {
      try {
        final ctx = await ref.read(expeditorApiProvider).getPaymentContext(slug, orderId);
        await _orderCache.savePaymentContext(slug, orderId, ctx);
        return ctx;
      } catch (_) {
        final cached = await _orderCache.loadPaymentContext(slug, orderId);
        if (cached != null) return cached;
        rethrow;
      }
    }
    final cached = await _orderCache.loadPaymentContext(slug, orderId);
    if (cached != null) return cached;
    throw Exception('Offline — to\'lov ma\'lumoti keshda yo\'q');
  },
);
