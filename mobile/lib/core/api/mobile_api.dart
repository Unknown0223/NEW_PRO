import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../sync/sync_payload_parser.dart';
import '../config/agent_cities.dart';
import '../config/tenant_references.dart';
import '../config/agent_limits.dart';
import '../device/mobile_device_info.dart';
import '../update/app_update_info.dart';
import 'api_exceptions.dart';
import 'dio_client.dart';

class MobileApi {
  final Dio _dio;
  MobileApi(this._dio);

  /// Fastify `application/json` bo‘sh body ni qabul qilmaydi — har doim `{}` yuboriladi.
  static Map<String, dynamic> _jsonBody([Map<String, dynamic>? body]) =>
      body ?? <String, dynamic>{};

  Future<AgentConfigResult> getAgentConfig(String slug) async {
    try {
      final version = await MobileDeviceInfo.apkVersion;
      final r = await _dio.get(
        '/api/$slug/mobile/agent-config',
        queryParameters: {'version': version},
      );
      return AgentConfigResult.fromJson(r.data);
    } on DioException catch (e) { throw _map(e); }
  }

  /// Login oldidan versiya siyosati (public endpoint).
  Future<AppUpdateInfo?> fetchAppRelease(String slug, String version) async {
    try {
      final r = await _dio.get(
        '/api/mobile/app-release',
        queryParameters: {
          'slug': slug,
          'version': version,
          'platform': 'android',
        },
      );
      final data = r.data;
      if (data is! Map) return null;
      final upd = data['update'];
      if (upd is! Map) return null;
      final info = AppUpdateInfo.fromJson(Map<String, dynamic>.from(upd));
      return info.hasAction ? info : null;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Web panel: «Название устройства» / «Версия APK».
  Future<void> reportPresence(String slug, Map<String, String> device) async {
    try {
      final body = <String, dynamic>{};
      for (final e in device.entries) {
        if (e.value.isNotEmpty) body[e.key] = e.value;
      }
      await _dio.post('/api/$slug/mobile/presence', data: _jsonBody(body));
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Map<String, dynamic> _syncFullBody({String? lastSyncAt, Map<String, String>? device}) {
    final body = <String, dynamic>{};
    if (lastSyncAt != null && lastSyncAt.isNotEmpty) {
      body['last_sync_at'] = lastSyncAt;
    }
    if (device != null) {
      for (final e in device.entries) {
        if (e.value.isNotEmpty) body[e.key] = e.value;
      }
    }
    return body;
  }

  /// JSON parse isolate da — katta payload uchun tezroq.
  Future<ParsedSyncPayload> syncFullParsed(
    String slug, {
    String? lastSyncAt,
    Map<String, String>? device,
  }) async {
    try {
      final r = await _dio.post<String>(
        '/api/$slug/mobile/sync/full',
        data: _jsonBody(_syncFullBody(lastSyncAt: lastSyncAt, device: device)),
        options: Options(
          receiveTimeout: const Duration(seconds: 120),
          responseType: ResponseType.plain,
        ),
      );
      return compute(parseSyncPayload, r.data ?? '{}');
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<SyncFullResult> syncFull(String slug, {String? lastSyncAt, Map<String, String>? device}) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/sync/full',
        data: _jsonBody(_syncFullBody(lastSyncAt: lastSyncAt, device: device)),
        options: Options(receiveTimeout: const Duration(seconds: 120)),
      );
      return SyncFullResult.fromJson(r.data);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<int> getPendingCount(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/orders/pending');
      return r.data['pending'] ?? 0;
    } on DioException catch (e) { throw _map(e); }
  }

  Future<SyncFullResult> syncDelta(
    String slug, {
    String? lastSyncAt,
    String? entityType,
    Map<String, String>? device,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (lastSyncAt != null && lastSyncAt.isNotEmpty) body['last_sync_at'] = lastSyncAt;
      if (entityType != null && entityType.isNotEmpty) body['entity_type'] = entityType;
      if (device != null) {
        for (final e in device.entries) {
          if (e.value.isNotEmpty) body[e.key] = e.value;
        }
      }
      final r = await _dio.post('/api/$slug/mobile/sync/delta', data: _jsonBody(body));
      return SyncFullResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) { throw _map(e); }
  }

  Future<Map<String, dynamic>> syncFlushOrders(String slug) async {
    try {
      final r = await _dio.post('/api/$slug/mobile/orders/sync-flush', data: _jsonBody());
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) { throw _map(e); }
  }

  Future<AgentDashboardResult> getAgentDashboard(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/agent-dashboard');
      return AgentDashboardResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) { throw _map(e); }
  }

  /// Agent zakazlar tarixi — bugun (yoki `date`: YYYY-MM-DD).
  Future<AgentOrdersHistoryResult> getOrdersHistory(String slug, {String? date}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/orders/history',
        queryParameters: date != null && date.isNotEmpty ? {'date': date} : null,
      );
      return AgentOrdersHistoryResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Bitta zakaz tafsiloti — mahsulotlar va bonus (qarz kartasi uchun).
  Future<AgentOrderHistoryRow> getOrderDetail(String slug, int orderId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/orders/$orderId/detail');
      final data = r.data as Map<String, dynamic>;
      return AgentOrderHistoryRow.fromJson(Map<String, dynamic>.from(data['data'] as Map));
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Bugungi savdo — kategoriya / mahsulot (Отчёты).
  Future<AgentDailySalesReport> getAgentDailySales(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/agent-daily-sales');
      return AgentDailySalesReport.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> createClient(String slug, Map<String, dynamic> body) async {
    try {
      final r = await _dio.post('/api/$slug/mobile/clients', data: body);
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<MobileUserProfile> getMyProfile(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/me/profile');
      return MobileUserProfile.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<MobileUserProfile> patchMyProfile(String slug, Map<String, dynamic> body) async {
    try {
      final r = await _dio.patch('/api/$slug/mobile/me/profile', data: body);
      return MobileUserProfile.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<void> changeMyPassword(String slug, {required String oldPassword, required String newPassword}) async {
    try {
      await _dio.post('/api/$slug/mobile/me/change-password', data: {
        'old_password': oldPassword,
        'new_password': newPassword,
      },);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> patchClient(String slug, int clientId, Map<String, dynamic> body) async {
    try {
      final r = await _dio.patch('/api/$slug/mobile/clients/$clientId', data: body);
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<DebtorClient>> getDebtors(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/clients/debtors');
      final list = r.data['data'] as List? ?? [];
      return list.map((e) => DebtorClient.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) { throw _map(e); }
  }

  /// Zakaz bo‘yicha ochiq qarzlar (web `reports/order-debts` bilan bir xil hisob).
  Future<OrderDebtsListResult> getOrderDebts(String slug, {int page = 1, int limit = 50}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/order-debts',
        queryParameters: {'page': page, 'limit': limit},
      );
      return OrderDebtsListResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> enqueueOrder(
    String slug, {
    required int clientId,
    required int warehouseId,
    required List items,
    String? priceType,
    String? comment,
  }) async {
    try {
      final r = await _dio.post('/api/$slug/mobile/orders/enqueue', data: {
        'client_id': clientId,
        'warehouse_id': warehouseId,
        'items': items,
        if (priceType != null) 'price_type': priceType,
        if (comment != null) 'comment': comment,
        'offline_created_at': DateTime.now().toUtc().toIso8601String(),
      },);
      return r.data;
    } on DioException catch (e) { throw _map(e); }
  }

  Future<List<ClientPhotoReport>> getClientPhotoReports(String slug, int clientId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/clients/$clientId/photo-reports');
      final list = r.data['data'] as List? ?? [];
      return list
          .map((e) => ClientPhotoReport.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<ClientPhotoReport> getClientPhotoReport(String slug, int clientId, int photoId) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/clients/$clientId/photo-reports/$photoId');
      return ClientPhotoReport.fromJson(Map<String, dynamic>.from(r.data as Map));
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<ClientPhotoReport> postClientPhotoReport(
    String slug,
    int clientId, {
    required String imageBase64,
    String? caption,
    int? orderId,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/clients/$clientId/photo-reports',
        data: {
          'image_base64': imageBase64,
          if (caption != null && caption.isNotEmpty) 'caption': caption,
          if (orderId != null && orderId > 0) 'order_id': orderId,
        },
      );
      return ClientPhotoReport.fromJson(Map<String, dynamic>.from(r.data as Map));
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<void> deleteClientPhotoReport(String slug, int clientId, int photoId) async {
    try {
      await _dio.delete('/api/$slug/mobile/clients/$clientId/photo-reports/$photoId');
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<ClientPhotoReport> linkClientPhotoToOrder(
    String slug,
    int clientId,
    int photoId, {
    required int orderId,
  }) async {
    try {
      final r = await _dio.patch(
        '/api/$slug/mobile/clients/$clientId/photo-reports/$photoId',
        data: {'order_id': orderId},
      );
      return ClientPhotoReport.fromJson(Map<String, dynamic>.from(r.data as Map));
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getOrderCashInContext(
    String slug, {
    required int clientId,
    List<int>? orderIds,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/payments/order-cash-in/context',
        queryParameters: {
          'client_id': clientId,
          if (orderIds != null && orderIds.isNotEmpty)
            'order_ids': orderIds.join(','),
        },
      );
      return Map<String, dynamic>.from(r.data['data'] as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> postOrderCashIn(
    String slug, {
    required int clientId,
    required int orderId,
    required String paymentType,
    required double amount,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/payments/order-cash-in',
        data: {
          'client_id': clientId,
          'lines': [
            {'order_id': orderId, 'payment_type': paymentType, 'amount': amount},
          ],
        },
      );
      return Map<String, dynamic>.from(r.data as Map);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<void> registerFcm(String slug, String token) async {
    try {
      await _dio.post('/api/$slug/mobile/fcm/register', data: {'token': token, 'device_type': 'android'});
    } on DioException catch (e) { throw _map(e); }
  }

  ApiException _map(DioException e) {
    if (e.type == DioExceptionType.connectionError || e.type == DioExceptionType.connectionTimeout) {
      return const NetworkException();
    }
    return mapDioException(e);
  }
}

final mobileApiProvider = Provider<MobileApi>((ref) => MobileApi(ref.read(dioProvider)));

class ClientPhotoReport {
  final int id;
  final String imageUrl;
  final String? caption;
  final int? orderId;
  final String createdAt;
  const ClientPhotoReport({
    required this.id,
    required this.imageUrl,
    this.caption,
    this.orderId,
    required this.createdAt,
  });
  factory ClientPhotoReport.fromJson(Map<String, dynamic> j) => ClientPhotoReport(
        id: (j['id'] as num).toInt(),
        imageUrl: j['image_url']?.toString() ?? '',
        caption: j['caption']?.toString(),
        orderId: (j['order_id'] as num?)?.toInt(),
        createdAt: j['created_at']?.toString() ?? '',
      );
}

class MobileUserProfile {
  final int id;
  final String name;
  final String login;
  final String? code;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? avatarBase64;

  const MobileUserProfile({
    required this.id,
    required this.name,
    required this.login,
    this.code,
    this.firstName,
    this.lastName,
    this.phone,
    this.avatarBase64,
  });

  factory MobileUserProfile.fromJson(Map<String, dynamic> j) => MobileUserProfile(
        id: (j['id'] as num).toInt(),
        name: j['name']?.toString() ?? '',
        code: j['code']?.toString(),
        login: j['login']?.toString() ?? '',
        firstName: j['first_name']?.toString(),
        lastName: j['last_name']?.toString(),
        phone: j['phone']?.toString(),
        avatarBase64: j['avatar_base64']?.toString(),
      );
}

class AgentConfigResult {
  final int userId;
  final String? tenantName;
  final Map<String, dynamic> mobileConfig;
  final Map<String, dynamic>? agentEntitlements;
  final AgentLimits agentLimits;
  final String? workSlotCode;
  final int? workSlotId;
  final TenantReferences tenantReferences;
  final List<AgentCityOption> agentCities;
  final AppUpdateInfo? appUpdate;
  AgentConfigResult({
    required this.userId,
    this.tenantName,
    required this.mobileConfig,
    this.agentEntitlements,
    this.agentLimits = const AgentLimits(),
    this.workSlotCode,
    this.workSlotId,
    this.tenantReferences = const TenantReferences(),
    this.agentCities = const [],
    this.appUpdate,
  });
  factory AgentConfigResult.fromJson(Map<String, dynamic> j) {
    final mc = j['mobile_config'];
    final tr = j['tenant_references'];
    final limitsRaw = j['agent_limits'];
    final upd = j['app_update'];
    return AgentConfigResult(
      userId: j['user_id'] as int? ?? 0,
      tenantName: j['tenant_name']?.toString(),
      mobileConfig: mc is Map<String, dynamic> ? mc : (mc is Map ? Map<String, dynamic>.from(mc) : {}),
      agentEntitlements: j['agent_entitlements'] is Map
          ? Map<String, dynamic>.from(j['agent_entitlements'] as Map)
          : null,
      agentLimits: limitsRaw is Map
          ? AgentLimits.fromJson(Map<String, dynamic>.from(limitsRaw))
          : const AgentLimits(),
      workSlotCode: j['work_slot_code']?.toString(),
      workSlotId: j['work_slot_id'] as int?,
      tenantReferences: tr is Map
          ? TenantReferences.fromJson(Map<String, dynamic>.from(tr))
          : const TenantReferences(),
      agentCities: parseAgentCities(j['agent_cities']),
      appUpdate: upd is Map ? AppUpdateInfo.fromJson(Map<String, dynamic>.from(upd)) : null,
    );
  }

  List<String> get priceTypes {
    final pt = agentEntitlements?['price_types'];
    if (pt is List) {
      final out = pt
          .map((e) => e?.toString().trim() ?? '')
          .where((s) => s.isNotEmpty)
          .toList();
      if (out.isNotEmpty) return out;
    }
    return const ['default'];
  }
}

class SyncFullResult {
  final String syncAt;
  final bool clientsReplaceAll;
  final List<SyncClient> clients;
  final List<SyncProduct> products;
  final List<SyncPrice> prices;
  final List<SyncOrder> orders;

  SyncFullResult({
    required this.syncAt,
    this.clientsReplaceAll = false,
    this.clients = const [],
    this.products = const [],
    this.prices = const [],
    this.orders = const [],
  });

  factory SyncFullResult.fromJson(Map<String, dynamic> j) => SyncFullResult(
    syncAt: j['sync_at'] ?? '',
    clientsReplaceAll: j['clients_replace_all'] == true,
    clients: (j['clients'] as List?)?.map((e) => SyncClient.fromJson(e)).toList() ?? [],
    products: (j['products'] as List?)?.map((e) => SyncProduct.fromJson(e)).toList() ?? [],
    prices: (j['prices'] as List?)?.map((e) => SyncPrice.fromJson(e)).toList() ?? [],
    orders: (j['orders'] as List?)?.map((e) => SyncOrder.fromJson(e)).toList() ?? [],
  );
}

class SyncClient {
  final int id;
  final String name;
  final String? address;
  final String? phone;
  final String? clientCode;
  final String? category;
  final bool isActive;
  final double? latitude;
  final double? longitude;
  final List<int> visitWeekdays;
  final double? balance;
  final double? creditLimit;
  final String? inn;
  final String? legalName;
  final String? salesChannel;
  final String? clientTypeCode;
  final String? region;
  final String? zone;
  final String? city;
  final String? bankName;
  final String? bankMfo;
  final String? oked;
  final String? clientPinfl;
  final String? contractNumber;
  final String? notes;
  final String? visitDate;

  SyncClient({
    required this.id,
    required this.name,
    this.address,
    this.phone,
    this.clientCode,
    this.category,
    this.isActive = true,
    this.latitude,
    this.longitude,
    this.visitWeekdays = const [],
    this.balance,
    this.creditLimit,
    this.inn,
    this.legalName,
    this.salesChannel,
    this.clientTypeCode,
    this.region,
    this.zone,
    this.city,
    this.bankName,
    this.bankMfo,
    this.oked,
    this.clientPinfl,
    this.contractNumber,
    this.notes,
    this.visitDate,
  });

  factory SyncClient.fromJson(Map<String, dynamic> j) {
    final wdRaw = j['visit_weekdays'];
    final weekdays = <int>[];
    if (wdRaw is List) {
      for (final x in wdRaw) {
        final n = x is num ? x.toInt() : int.tryParse(x.toString());
        if (n != null && n >= 1 && n <= 7) weekdays.add(n);
      }
    }
    return SyncClient(
      id: (j['id'] as num).toInt(),
      name: j['name']?.toString() ?? '',
      address: j['address']?.toString(),
      phone: j['phone']?.toString(),
      clientCode: j['client_code']?.toString(),
      category: j['category']?.toString(),
      isActive: j['is_active'] != false,
      latitude: (j['latitude'] as num?)?.toDouble(),
      longitude: (j['longitude'] as num?)?.toDouble(),
      visitWeekdays: weekdays.toSet().toList()..sort(),
      balance: (j['balance'] as num?)?.toDouble(),
      creditLimit: _parseOptionalNum(j['credit_limit']),
      inn: j['inn']?.toString(),
      legalName: j['legal_name']?.toString(),
      salesChannel: j['sales_channel']?.toString(),
      clientTypeCode: j['client_type_code']?.toString(),
      region: j['region']?.toString(),
      zone: j['zone']?.toString(),
      city: j['city']?.toString(),
      bankName: j['bank_name']?.toString(),
      bankMfo: j['bank_mfo']?.toString(),
      oked: j['oked']?.toString(),
      clientPinfl: j['client_pinfl']?.toString(),
      contractNumber: j['contract_number']?.toString(),
      notes: j['notes']?.toString(),
      visitDate: j['visit_date']?.toString(),
    );
  }

  static double? _parseOptionalNum(dynamic v) {
    if (v == null) return null;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString().replaceAll(',', '.'));
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'name': name,
    'address': address,
    'phone': phone,
    'client_code': clientCode,
    'category': category,
    'is_active': isActive ? 1 : 0,
    'latitude': latitude,
    'longitude': longitude,
    'visit_weekdays': visitWeekdays.isEmpty ? null : jsonEncode(visitWeekdays),
    'balance': balance,
    if (creditLimit != null) 'credit_limit': creditLimit,
    if (inn != null && inn!.isNotEmpty) 'inn': inn,
    if (legalName != null && legalName!.isNotEmpty) 'legal_name': legalName,
    if (salesChannel != null && salesChannel!.isNotEmpty) 'sales_channel': salesChannel,
    if (clientTypeCode != null && clientTypeCode!.isNotEmpty) 'client_type_code': clientTypeCode,
    if (region != null && region!.isNotEmpty) 'region': region,
    if (zone != null && zone!.isNotEmpty) 'zone': zone,
    if (city != null && city!.isNotEmpty) 'city': city,
    if (bankName != null && bankName!.isNotEmpty) 'bank_name': bankName,
    if (bankMfo != null && bankMfo!.isNotEmpty) 'bank_mfo': bankMfo,
    if (oked != null && oked!.isNotEmpty) 'oked': oked,
    if (clientPinfl != null && clientPinfl!.isNotEmpty) 'client_pinfl': clientPinfl,
    if (contractNumber != null && contractNumber!.isNotEmpty) 'contract_number': contractNumber,
    if (notes != null && notes!.isNotEmpty) 'notes': notes,
    if (visitDate != null && visitDate!.isNotEmpty) 'visit_date': visitDate,
  };
}

class SyncProduct {
  final int id; final String? sku; final String name; final String? unit, barcode;
  SyncProduct({required this.id, this.sku, required this.name, this.unit, this.barcode});
  factory SyncProduct.fromJson(Map<String, dynamic> j) => SyncProduct(
    id: (j['id'] as num).toInt(),
    sku: j['sku']?.toString(),
    name: j['name']?.toString() ?? '',
    unit: j['unit']?.toString(),
    barcode: j['barcode']?.toString(),
  );
  Map<String, dynamic> toMap() => {'id': id, 'sku': sku, 'name': name, 'unit': unit, 'barcode': barcode};
}

class SyncPrice {
  final int productId; final String? priceType; final double price;
  SyncPrice({required this.productId, this.priceType, required this.price});
  factory SyncPrice.fromJson(Map<String, dynamic> j) => SyncPrice(
    productId: (j['product_id'] as num).toInt(),
    priceType: j['price_type']?.toString(),
    price: (j['price'] as num).toDouble(),
  );
}

class SyncOrder {
  final int id;
  final String? number;
  final int clientId;
  final String status;
  final String? createdAt;
  final double total;

  SyncOrder({
    required this.id,
    this.number,
    required this.clientId,
    required this.status,
    this.createdAt,
    this.total = 0,
  });

  factory SyncOrder.fromJson(Map<String, dynamic> j) => SyncOrder(
        id: (j['id'] as num).toInt(),
        number: j['number']?.toString(),
        clientId: (j['client_id'] as num).toInt(),
        status: j['status']?.toString() ?? 'new',
        createdAt: j['created_at']?.toString(),
        total: (j['total_sum'] as num?)?.toDouble() ?? (j['total'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'number': number,
        'client_id': clientId,
        'status': status,
        'total': total,
        if (createdAt != null && createdAt!.isNotEmpty) 'created_at': createdAt,
      };
}

class AgentDailySalesReport {
  final String date;
  final AgentDailySalesTotals totals;
  final List<AgentDailySalesRow> rows;

  AgentDailySalesReport({
    required this.date,
    required this.totals,
    required this.rows,
  });

  factory AgentDailySalesReport.empty() => AgentDailySalesReport(
        date: '',
        totals: AgentDailySalesTotals(qty: 0, volumeM3: 0, sum: 0, akb: 0),
        rows: const [],
      );

  factory AgentDailySalesReport.fromJson(Map<String, dynamic> j) {
    final t = j['totals'];
    final list = j['rows'] as List? ?? [];
    return AgentDailySalesReport(
      date: j['date']?.toString() ?? '',
      totals: t is Map
          ? AgentDailySalesTotals.fromJson(Map<String, dynamic>.from(t))
          : AgentDailySalesTotals(qty: 0, volumeM3: 0, sum: 0, akb: 0),
      rows: list
          .map((e) => AgentDailySalesRow.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}

class AgentDailySalesTotals {
  final double qty;
  final double volumeM3;
  final double sum;
  final int akb;

  AgentDailySalesTotals({
    required this.qty,
    required this.volumeM3,
    required this.sum,
    required this.akb,
  });

  factory AgentDailySalesTotals.fromJson(Map<String, dynamic> j) => AgentDailySalesTotals(
        qty: _parseMobileNum(j['qty']),
        volumeM3: _parseMobileNum(j['volume_m3']),
        sum: _parseMobileNum(j['sum']),
        akb: (j['akb'] as num?)?.toInt() ?? 0,
      );
}

class AgentDailySalesRow {
  final String name;
  final double qty;
  final double volumeM3;
  final double sum;
  final int depth;

  AgentDailySalesRow({
    required this.name,
    required this.qty,
    required this.volumeM3,
    required this.sum,
    required this.depth,
  });

  factory AgentDailySalesRow.fromJson(Map<String, dynamic> j) => AgentDailySalesRow(
        name: j['name']?.toString() ?? '—',
        qty: _parseMobileNum(j['qty']),
        volumeM3: _parseMobileNum(j['volume_m3']),
        sum: _parseMobileNum(j['sum']),
        depth: (j['depth'] as num?)?.toInt() ?? 0,
      );
}

double _parseMobileNum(dynamic v) {
  if (v is num) return v.toDouble();
  return double.tryParse(v?.toString().replaceAll(',', '.') ?? '') ?? 0;
}

class AgentDashboardResult {
  final int clientsCount;
  final int visitsToday;
  final int ordersToday;
  final double ordersSumToday;
  final double planSum;
  final double performancePct;
  final int pendingOffline;

  AgentDashboardResult({
    required this.clientsCount,
    required this.visitsToday,
    required this.ordersToday,
    required this.ordersSumToday,
    required this.planSum,
    required this.performancePct,
    required this.pendingOffline,
  });

  factory AgentDashboardResult.fromJson(Map<String, dynamic> j) => AgentDashboardResult(
    clientsCount: j['clients_count'] as int? ?? 0,
    visitsToday: j['visits_today'] as int? ?? 0,
    ordersToday: j['orders_today'] as int? ?? 0,
    ordersSumToday: (j['orders_sum_today'] as num?)?.toDouble() ?? 0,
    planSum: (j['plan_sum'] as num?)?.toDouble() ?? 0,
    performancePct: (j['performance_pct'] as num?)?.toDouble() ?? 0,
    pendingOffline: j['pending_offline'] as int? ?? 0,
  );
}

class DebtorClient {
  final int id;
  final String name;
  final String? phone;
  final String? clientCode;
  final double balance;
  final String? overdueAt;

  DebtorClient({
    required this.id,
    required this.name,
    this.phone,
    this.clientCode,
    required this.balance,
    this.overdueAt,
  });

  factory DebtorClient.fromJson(Map<String, dynamic> j) => DebtorClient(
        id: (j['id'] as num).toInt(),
        name: j['name']?.toString() ?? '',
        phone: j['phone']?.toString(),
        clientCode: j['client_code']?.toString(),
        balance: (j['balance'] as num?)?.toDouble() ?? 0,
        overdueAt: j['overdue_at']?.toString(),
      );
}

class OrderDebtRow {
  final int orderId;
  final String orderNumber;
  final String orderStatus;
  final int clientId;
  final String clientName;
  final double remainder;
  final double totalSum;
  final double allocatedSum;
  final String? shippedAt;

  OrderDebtRow({
    required this.orderId,
    required this.orderNumber,
    this.orderStatus = '',
    required this.clientId,
    required this.clientName,
    required this.remainder,
    this.totalSum = 0,
    this.allocatedSum = 0,
    this.shippedAt,
  });

  factory OrderDebtRow.fromJson(Map<String, dynamic> j) => OrderDebtRow(
        orderId: (j['order_id'] as num).toInt(),
        orderNumber: j['order_number']?.toString() ?? '',
        orderStatus: j['order_status']?.toString() ?? '',
        clientId: (j['client_id'] as num).toInt(),
        clientName: j['client_name']?.toString() ?? '',
        remainder: double.tryParse(j['remainder']?.toString() ?? '') ?? 0,
        totalSum: double.tryParse(j['total_sum']?.toString() ?? '') ?? 0,
        allocatedSum: double.tryParse(j['allocated_sum']?.toString() ?? '') ?? 0,
        shippedAt: j['shipped_at']?.toString(),
      );
}

class AgentOrderHistoryItem {
  final String productName;
  final double qty;
  final double price;
  final double total;
  final bool isBonus;

  const AgentOrderHistoryItem({
    required this.productName,
    required this.qty,
    required this.price,
    required this.total,
    this.isBonus = false,
  });

  factory AgentOrderHistoryItem.fromJson(Map<String, dynamic> j) => AgentOrderHistoryItem(
        productName: j['product_name']?.toString() ?? '',
        qty: (j['qty'] as num?)?.toDouble() ?? 0,
        price: (j['price'] as num?)?.toDouble() ?? 0,
        total: (j['total'] as num?)?.toDouble() ?? 0,
        isBonus: j['is_bonus'] == true,
      );
}

class AgentOrderHistoryRow {
  final int id;
  final String? number;
  final String orderType;
  final String status;
  final String clientName;
  final String? createdAt;
  final double totalSum;
  final double bonusSum;
  final double discountSum;
  final double qty;
  final double bonusQty;
  final double? volumeM3;
  final List<AgentOrderHistoryItem> items;

  const AgentOrderHistoryRow({
    required this.id,
    this.number,
    this.orderType = 'order',
    required this.status,
    required this.clientName,
    this.createdAt,
    this.totalSum = 0,
    this.bonusSum = 0,
    this.discountSum = 0,
    this.qty = 0,
    this.bonusQty = 0,
    this.volumeM3,
    this.items = const [],
  });

  factory AgentOrderHistoryRow.fromJson(Map<String, dynamic> j) {
    final list = j['items'] as List? ?? [];
    return AgentOrderHistoryRow(
      id: (j['id'] as num).toInt(),
      number: j['number']?.toString(),
      orderType: j['order_type']?.toString() ?? 'order',
      status: j['status']?.toString() ?? 'new',
      clientName: j['client_name']?.toString() ?? '',
      createdAt: j['created_at']?.toString(),
      totalSum: (j['total_sum'] as num?)?.toDouble() ?? 0,
      bonusSum: (j['bonus_sum'] as num?)?.toDouble() ?? 0,
      discountSum: (j['discount_sum'] as num?)?.toDouble() ?? 0,
      qty: (j['qty'] as num?)?.toDouble() ?? 0,
      bonusQty: (j['bonus_qty'] as num?)?.toDouble() ?? 0,
      volumeM3: (j['volume_m3'] as num?)?.toDouble(),
      items: list.map((e) => AgentOrderHistoryItem.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
    );
  }
}

class AgentOrdersHistoryResult {
  final String date;
  final List<AgentOrderHistoryRow> orders;

  const AgentOrdersHistoryResult({required this.date, this.orders = const []});

  factory AgentOrdersHistoryResult.fromJson(Map<String, dynamic> j) {
    final list = j['data'] as List? ?? [];
    return AgentOrdersHistoryResult(
      date: j['date']?.toString() ?? '',
      orders: list.map((e) => AgentOrderHistoryRow.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
    );
  }
}

class OrderDebtsListResult {
  final List<OrderDebtRow> data;
  final int total;
  final double totalRemainder;
  final String currency;

  OrderDebtsListResult({
    required this.data,
    required this.total,
    required this.totalRemainder,
    required this.currency,
  });

  factory OrderDebtsListResult.fromJson(Map<String, dynamic> j) {
    final list = j['data'] as List? ?? [];
    final summary = j['summary'] as Map<String, dynamic>? ?? {};
    return OrderDebtsListResult(
      data: list.map((e) => OrderDebtRow.fromJson(e as Map<String, dynamic>)).toList(),
      total: j['total'] as int? ?? list.length,
      totalRemainder: double.tryParse(summary['total_remainder']?.toString() ?? '') ?? 0,
      currency: summary['currency']?.toString() ?? 'UZS',
    );
  }
}
