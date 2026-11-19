import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';

class ExpeditorApi {
  final Dio _dio;
  ExpeditorApi(this._dio);

  Future<ExpeditorDeliveriesResult> listDeliveries(
    String slug, {
    int page = 1,
    int limit = 50,
    String? status,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/deliveries',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      return ExpeditorDeliveriesResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getOrderDetail(String slug, int orderId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/orders/$orderId');
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> patchOrderStatus(
    String slug,
    int orderId,
    String status, {
    String? reason,
  }) async {
    try {
      final r = await _dio.patch(
        '/api/$slug/mobile/expeditor/orders/$orderId/status',
        data: {
          'status': status,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getPaymentContext(String slug, int orderId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/orders/$orderId/payment-context');
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> createPayment(
    String slug,
    int orderId, {
    required String paymentType,
    required double amount,
    String? note,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/orders/$orderId/payments',
        data: {
          'payment_type': paymentType,
          'amount': amount,
          if (note != null && note.isNotEmpty) 'note': note,
        },
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> partialReturn(
    String slug,
    int orderId, {
    required String reason,
    String? note,
    List<Map<String, dynamic>>? items,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/orders/$orderId/partial-return',
        data: {
          'reason': reason,
          if (note != null && note.isNotEmpty) 'note': note,
          if (items != null && items.isNotEmpty) 'items': items,
        },
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> reloadFromVehicle(
    String slug,
    int orderId, {
    String? note,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/orders/$orderId/reload-from-vehicle',
        data: {if (note != null && note.isNotEmpty) 'note': note},
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// «Возврат с полки по заказу» — tanlanadigan zakazlar (balans/davr filtri).
  Future<Map<String, dynamic>> listReturnByOrderOrders(String slug) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/return-by-order/orders',
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Bitta zakaz tarkibi — qaytarish mumkin bo'lgan mahsulotlar.
  Future<Map<String, dynamic>> getReturnByOrderComposition(
    String slug,
    int orderId,
  ) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/orders/$orderId/return-by-order/composition',
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// «Возврат с полки по заказу» oldindan hisoblash — tizim bonus mexanizmi
  /// bo'yicha savdo/bonus bo'linishi va bonus kamchiligi (qarzga o'tuvchi summa).
  /// `lines`: `[{product_id, return_qty}]`.
  Future<Map<String, dynamic>> previewReturnByOrder(
    String slug,
    int orderId, {
    required List<Map<String, dynamic>> lines,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/orders/$orderId/return-by-order/preview',
        data: {'lines': lines},
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// «Возврат с полки по заказу» yaratish.
  Future<Map<String, dynamic>> createReturnByOrder(
    String slug,
    int orderId, {
    required List<Map<String, dynamic>> lines,
    String? note,
    String? reason,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/orders/$orderId/return-by-order',
        data: {
          'lines': lines,
          if (note != null && note.isNotEmpty) 'note': note,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Ekspeditor o'zi shakllantirgan qaytarish hujjatlari (topshiriladigan
  /// mahsulotlar + zavsklad qabul holati).
  Future<List<Map<String, dynamic>>> listMyReturns(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/returns');
      final data = (r.data as Map)['data'] as List? ?? const [];
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> patchClientLocation(
    String slug,
    int clientId, {
    required double latitude,
    required double longitude,
  }) async {
    try {
      final r = await _dio.patch(
        '/api/$slug/mobile/expeditor/clients/$clientId/location',
        data: {'latitude': latitude, 'longitude': longitude},
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getDashboard(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/dashboard');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<Map<String, dynamic>>> listVisits(String slug, {required String tab}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/visits',
        queryParameters: {'tab': tab},
      );
      return (r.data['data'] as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<Map<String, dynamic>>> listDebtors(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/debtors');
      return (r.data['data'] as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Kassir tomonidan qaytarilgan (taymerli) to'lovlar — to'g'rilash uchun.
  Future<List<Map<String, dynamic>>> listReturnedPayments(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/returned-payments');
      return (r.data['data'] as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getClientBalanceDetail(
    String slug,
    int clientId,
  ) async {
    try {
      final r = await _dio
          .get('/api/$slug/mobile/expeditor/client/$clientId/balance-detail');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Mijoz kartasi: sarlavha + to'lov tarixi (Оплата) + qaytarilgan zakazlar.
  Future<Map<String, dynamic>> getClientDetail(
    String slug,
    int clientId,
  ) async {
    try {
      final r =
          await _dio.get('/api/$slug/mobile/expeditor/client/$clientId/detail');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// История заказов — mijoz zakazlari (ixtiyoriy sana filtri bilan).
  Future<List<Map<String, dynamic>>> getClientOrders(
    String slug,
    int clientId, {
    String? dateFrom,
    String? dateTo,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/client/$clientId/orders',
        queryParameters: {
          if (dateFrom != null) 'date_from': dateFrom,
          if (dateTo != null) 'date_to': dateTo,
        },
      );
      return (r.data['data'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Акт сверки — mijoz ledger (sana filtri bilan).
  Future<Map<String, dynamic>> getClientLedger(
    String slug,
    int clientId, {
    String? dateFrom,
    String? dateTo,
    int page = 1,
    String? kind,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/client/$clientId/ledger',
        queryParameters: {
          if (dateFrom != null) 'date_from': dateFrom,
          if (dateTo != null) 'date_to': dateTo,
          'page': page,
          if (kind != null) 'kind': kind,
        },
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> listPaymentsSummary(String slug, {String groupBy = 'list'}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/payments-summary',
        queryParameters: {'group_by': groupBy},
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<Map<String, dynamic>>> listShipmentDocuments(String slug, {required String type}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/shipment-documents',
        queryParameters: {'type': type},
      );
      return (r.data['data'] as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getShipmentDocument(String slug, String docId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/shipment-documents/$docId');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> confirmShipmentDocument(String slug, String docId) async {
    try {
      final r = await _dio.post('/api/$slug/mobile/expeditor/shipment-documents/$docId/confirm');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<Map<String, dynamic>>> listWarehouses(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/warehouses');
      return (r.data['data'] as List?)?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Mashinadagi qoldiq — skladdan olingan, hali yetkazilmagan mahsulotlar.
  Future<Map<String, dynamic>> getVehicleStock(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/vehicle-stock');
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  ApiException _map(DioException e) {
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return const NetworkException();
    }
    final code = e.response?.statusCode ?? 0;
    final msg = e.response?.data?['message']?.toString() ?? e.message ?? 'Xato';
    return ApiException.fromStatusCode(code, msg);
  }
}

final expeditorApiProvider = Provider<ExpeditorApi>((ref) => ExpeditorApi(ref.read(dioProvider)));

class ExpeditorDeliveriesResult {
  final List<Map<String, dynamic>> data;
  final int total;
  final int page;
  final int limit;

  ExpeditorDeliveriesResult({
    required this.data,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory ExpeditorDeliveriesResult.fromJson(Map<String, dynamic> j) => ExpeditorDeliveriesResult(
        data: (j['data'] as List?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [],
        total: j['total'] as int? ?? 0,
        page: j['page'] as int? ?? 1,
        limit: j['limit'] as int? ?? 50,
      );
}
