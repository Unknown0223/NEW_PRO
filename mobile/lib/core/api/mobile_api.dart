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

  Map<String, dynamic> _syncFullBody({
    String? lastSyncAt,
    Map<String, String>? device,
    bool forceClientsCatalog = false,
  }) {
    final body = <String, dynamic>{};
    if (lastSyncAt != null && lastSyncAt.isNotEmpty) {
      body['last_sync_at'] = lastSyncAt;
    }
    if (forceClientsCatalog) {
      body['force_clients_catalog'] = true;
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
    bool forceClientsCatalog = false,
  }) async {
    try {
      final r = await _dio.post<String>(
        '/api/$slug/mobile/sync/full',
        data: _jsonBody(_syncFullBody(
          lastSyncAt: lastSyncAt,
          device: device,
          forceClientsCatalog: forceClientsCatalog,
        )),
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

  /// Agent oylik табель (self) — web timesheet moduli bilan bitta manba.
  /// [month] — `YYYY-MM`; bo‘sh bo‘lsa server joriy oyni qaytaradi.
  Future<AgentTimesheetResult> getAgentTimesheet(String slug, {String? month}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/agent-timesheet',
        queryParameters:
            month != null && month.isNotEmpty ? {'month': month} : null,
      );
      return AgentTimesheetResult.fromJson(r.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// Agent KPI (plan/fact) — web «Установка планов» + timesheet.
  /// [month] — `YYYY-MM`; bo‘sh bo‘lsa joriy oy.
  Future<AgentKpiResult> getAgentKpi(String slug, {String? month}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/agent-kpi',
        queryParameters:
            month != null && month.isNotEmpty ? {'month': month} : null,
      );
      return AgentKpiResult.fromJson(r.data as Map<String, dynamic>);
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

  /// Joriy agent bo‘yicha mijozlar umumiy balansi (veb kartochka «Общий» per agent).
  Future<Map<int, double>> getClientLedgerBalances(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/clients/balances');
      final list = r.data['data'] as List? ?? [];
      final out = <int, double>{};
      for (final raw in list) {
        final j = raw as Map<String, dynamic>;
        final id = (j['id'] as num?)?.toInt();
        if (id == null) continue;
        out[id] = (j['balance'] as num?)?.toDouble() ?? 0;
      }
      return out;
    } on DioException catch (e) {
      throw _map(e);
    }
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

class AgentTimesheetEmployee {
  final int id;
  final String fio;
  final String role;
  final String login;
  final String? code;

  const AgentTimesheetEmployee({
    required this.id,
    required this.fio,
    required this.role,
    required this.login,
    this.code,
  });

  factory AgentTimesheetEmployee.fromJson(Map<String, dynamic> j) =>
      AgentTimesheetEmployee(
        id: (j['id'] as num?)?.toInt() ?? 0,
        fio: j['fio']?.toString() ?? '',
        role: j['role']?.toString() ?? 'agent',
        login: j['login']?.toString() ?? '',
        code: j['code']?.toString(),
      );
}

class AgentTimesheetDayHistory {
  final String id;
  final String? oldValue;
  final String? newValue;
  final String? comment;
  final String changedBy;
  final String changedAt;

  const AgentTimesheetDayHistory({
    required this.id,
    this.oldValue,
    this.newValue,
    this.comment,
    required this.changedBy,
    required this.changedAt,
  });

  factory AgentTimesheetDayHistory.fromJson(Map<String, dynamic> j) =>
      AgentTimesheetDayHistory(
        id: j['id']?.toString() ?? '',
        oldValue: j['old_value']?.toString(),
        newValue: j['new_value']?.toString(),
        comment: j['comment']?.toString(),
        changedBy: j['changed_by']?.toString() ?? '',
        changedAt: j['changed_at']?.toString() ?? '',
      );
}

class AgentTimesheetDay {
  final int day;
  final String date; // YYYY-MM-DD
  final int weekday; // 1=Пн … 7=Вс
  final String status; // backend: worked/half_day/absent/holiday/vacation/sick/trip
  final String source; // manual/gps/mobile_login/auto
  final double sales;
  final int visits;
  final int workedMinutes;
  final String? comment;
  final List<AgentTimesheetDayHistory> history;

  const AgentTimesheetDay({
    required this.day,
    required this.date,
    required this.weekday,
    required this.status,
    required this.source,
    required this.sales,
    required this.visits,
    required this.workedMinutes,
    this.comment,
    this.history = const [],
  });

  factory AgentTimesheetDay.fromJson(Map<String, dynamic> j) {
    final hist = j['history'] as List? ?? [];
    return AgentTimesheetDay(
      day: (j['day'] as num?)?.toInt() ?? 0,
      date: j['date']?.toString() ?? '',
      weekday: (j['weekday'] as num?)?.toInt() ?? 1,
      status: j['status']?.toString() ?? 'absent',
      source: j['source']?.toString() ?? 'auto',
      sales: _parseMobileNum(j['sales']),
      visits: (j['visits'] as num?)?.toInt() ?? 0,
      workedMinutes: (j['worked_minutes'] as num?)?.toInt() ?? 0,
      comment: j['comment']?.toString(),
      history: hist
          .whereType<Map>()
          .map((e) => AgentTimesheetDayHistory.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class AgentTimesheetTotals {
  final int daysInMonth;
  final double workedDays;
  final int activeDays;
  final int halfDays;
  final int absentDays;
  final int holidayDays;
  final int vacationDays;
  final int sickDays;
  final int tripDays;
  final double salesTotal;
  final int visitsTotal;
  final int workedMinutesTotal;

  const AgentTimesheetTotals({
    required this.daysInMonth,
    required this.workedDays,
    required this.activeDays,
    required this.halfDays,
    required this.absentDays,
    required this.holidayDays,
    required this.vacationDays,
    required this.sickDays,
    required this.tripDays,
    required this.salesTotal,
    required this.visitsTotal,
    required this.workedMinutesTotal,
  });

  factory AgentTimesheetTotals.empty() => const AgentTimesheetTotals(
        daysInMonth: 0,
        workedDays: 0,
        activeDays: 0,
        halfDays: 0,
        absentDays: 0,
        holidayDays: 0,
        vacationDays: 0,
        sickDays: 0,
        tripDays: 0,
        salesTotal: 0,
        visitsTotal: 0,
        workedMinutesTotal: 0,
      );

  factory AgentTimesheetTotals.fromJson(Map<String, dynamic> j) =>
      AgentTimesheetTotals(
        daysInMonth: (j['days_in_month'] as num?)?.toInt() ?? 0,
        workedDays: _parseMobileNum(j['worked_days']),
        activeDays: (j['active_days'] as num?)?.toInt() ?? 0,
        halfDays: (j['half_days'] as num?)?.toInt() ?? 0,
        absentDays: (j['absent_days'] as num?)?.toInt() ?? 0,
        holidayDays: (j['holiday_days'] as num?)?.toInt() ?? 0,
        vacationDays: (j['vacation_days'] as num?)?.toInt() ?? 0,
        sickDays: (j['sick_days'] as num?)?.toInt() ?? 0,
        tripDays: (j['trip_days'] as num?)?.toInt() ?? 0,
        salesTotal: _parseMobileNum(j['sales_total']),
        visitsTotal: (j['visits_total'] as num?)?.toInt() ?? 0,
        workedMinutesTotal: (j['worked_minutes_total'] as num?)?.toInt() ?? 0,
      );
}

class AgentTimesheetResult {
  final String month; // YYYY-MM
  final AgentTimesheetEmployee employee;
  final bool locked;
  final List<AgentTimesheetDay> days;
  final AgentTimesheetTotals totals;

  const AgentTimesheetResult({
    required this.month,
    required this.employee,
    required this.locked,
    required this.days,
    required this.totals,
  });

  factory AgentTimesheetResult.fromJson(Map<String, dynamic> j) {
    final list = j['days'] as List? ?? [];
    final emp = j['employee'];
    final t = j['totals'];
    return AgentTimesheetResult(
      month: j['month']?.toString() ?? '',
      employee: emp is Map
          ? AgentTimesheetEmployee.fromJson(Map<String, dynamic>.from(emp))
          : const AgentTimesheetEmployee(id: 0, fio: '', role: 'agent', login: ''),
      locked: j['locked'] == true,
      days: list
          .map((e) => AgentTimesheetDay.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
      totals: t is Map
          ? AgentTimesheetTotals.fromJson(Map<String, dynamic>.from(t))
          : AgentTimesheetTotals.empty(),
    );
  }
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

class AgentKpiMetricBlock {
  final double cost;
  final double count;
  final double volume;
  final double acb;
  final int orderCount;

  const AgentKpiMetricBlock({
    required this.cost,
    required this.count,
    required this.volume,
    required this.acb,
    required this.orderCount,
  });

  factory AgentKpiMetricBlock.fromJson(Map<String, dynamic>? j) {
    if (j == null) {
      return const AgentKpiMetricBlock(
        cost: 0,
        count: 0,
        volume: 0,
        acb: 0,
        orderCount: 0,
      );
    }
    return AgentKpiMetricBlock(
      cost: _parseMobileNum(j['cost']),
      count: _parseMobileNum(j['count']),
      volume: _parseMobileNum(j['volume']),
      acb: _parseMobileNum(j['acb']),
      orderCount: (j['order_count'] as num?)?.toInt() ?? 0,
    );
  }

  double primaryValue(String metric) {
    switch (metric) {
      case 'count':
        return count;
      case 'volume':
        return volume;
      case 'acb':
        return acb;
      case 'order_count':
        return orderCount.toDouble();
      default:
        return cost;
    }
  }
}

class AgentKpiGroupRow {
  final int kpiGroupId;
  final String name;
  final String? code;
  /// Settings «Группа KPI» is_active; null = eski API (filtr backendga).
  final bool? isActive;
  final String planStatus;
  final int productCount;
  final AgentKpiMetricBlock plan;
  final AgentKpiMetricBlock fact;
  final String primaryMetric;
  final double? executionPct;
  final double? remainingPrimary;
  final double todayPlanPrimary;
  final double todayFactPrimary;
  final double? todayExecutionPct;
  final double todayRemainingPrimary;
  final double? weightPct;
  final double? score;
  final String? hint;

  const AgentKpiGroupRow({
    required this.kpiGroupId,
    required this.name,
    this.code,
    this.isActive,
    required this.planStatus,
    required this.productCount,
    required this.plan,
    required this.fact,
    required this.primaryMetric,
    this.executionPct,
    this.remainingPrimary,
    this.todayPlanPrimary = 0,
    this.todayFactPrimary = 0,
    this.todayExecutionPct,
    this.todayRemainingPrimary = 0,
    this.weightPct,
    this.score,
    this.hint,
  });

  factory AgentKpiGroupRow.fromJson(Map<String, dynamic> j) => AgentKpiGroupRow(
        kpiGroupId: (j['kpi_group_id'] as num?)?.toInt() ?? 0,
        name: j['name']?.toString() ?? '—',
        code: j['code']?.toString(),
        isActive: j['is_active'] is bool ? j['is_active'] as bool : null,
        planStatus: j['plan_status']?.toString() ?? '',
        productCount: (j['product_count'] as num?)?.toInt() ?? 0,
        plan: AgentKpiMetricBlock.fromJson(
          j['plan'] is Map ? Map<String, dynamic>.from(j['plan'] as Map) : null,
        ),
        fact: AgentKpiMetricBlock.fromJson(
          j['fact'] is Map ? Map<String, dynamic>.from(j['fact'] as Map) : null,
        ),
        primaryMetric: j['primary_metric']?.toString() ?? 'cost',
        executionPct: (j['execution_pct'] as num?)?.toDouble(),
        remainingPrimary: (j['remaining_primary'] as num?)?.toDouble(),
        todayPlanPrimary: _parseMobileNum(j['today_plan_primary']),
        todayFactPrimary: _parseMobileNum(j['today_fact_primary']),
        todayExecutionPct: (j['today_execution_pct'] as num?)?.toDouble(),
        todayRemainingPrimary: _parseMobileNum(j['today_remaining_primary']),
        weightPct: (j['weight_pct'] as num?)?.toDouble(),
        score: (j['score'] as num?)?.toDouble(),
        hint: j['hint']?.toString(),
      );
}

class AgentKpiWeekDay {
  final String date;
  final int weekday;
  final double salesSum;
  final double? planSum;
  final double? executionPct;

  const AgentKpiWeekDay({
    required this.date,
    required this.weekday,
    required this.salesSum,
    this.planSum,
    this.executionPct,
  });

  factory AgentKpiWeekDay.fromJson(Map<String, dynamic> j) => AgentKpiWeekDay(
        date: j['date']?.toString() ?? '',
        weekday: (j['weekday'] as num?)?.toInt() ?? 1,
        salesSum: _parseMobileNum(j['sales_sum']),
        planSum: j['plan_sum'] != null ? _parseMobileNum(j['plan_sum']) : null,
        executionPct: (j['execution_pct'] as num?)?.toDouble(),
      );
}

class AgentKpiDailyRouteDay {
  final String date;
  final bool isWorkingDay;
  final bool isToday;
  final bool isFuture;
  final double planSum;
  final double factSum;
  final double? executionPct;
  final double remainingSum;
  final double overSum;
  final double carryIn;
  final String status;

  const AgentKpiDailyRouteDay({
    required this.date,
    required this.isWorkingDay,
    required this.isToday,
    required this.isFuture,
    required this.planSum,
    required this.factSum,
    this.executionPct,
    required this.remainingSum,
    this.overSum = 0,
    required this.carryIn,
    required this.status,
  });

  factory AgentKpiDailyRouteDay.fromJson(Map<String, dynamic> j) => AgentKpiDailyRouteDay(
        date: j['date']?.toString() ?? '',
        isWorkingDay: j['is_working_day'] == true,
        isToday: j['is_today'] == true,
        isFuture: j['is_future'] == true,
        planSum: _parseMobileNum(j['plan_sum']),
        factSum: _parseMobileNum(j['fact_sum']),
        executionPct: (j['execution_pct'] as num?)?.toDouble(),
        remainingSum: _parseMobileNum(j['remaining_sum']),
        overSum: _parseMobileNum(j['over_sum']),
        carryIn: _parseMobileNum(j['carry_in']),
        status: j['status']?.toString() ?? 'pending',
      );
}

class AgentKpiDailyRoute {
  final int workingDaysTotal;
  final int remainingWorkingDays;
  final int pastWorkingDays;
  final double baseDayPlan;
  final double todayPlanSum;
  final double factBeforeToday;
  final double monthRemainingBeforeToday;
  final double carryForwardSum;
  final double surplusSum;
  final double? vsYesterdayPct;
  final List<AgentKpiDailyRouteDay> days;

  const AgentKpiDailyRoute({
    required this.workingDaysTotal,
    required this.remainingWorkingDays,
    required this.pastWorkingDays,
    required this.baseDayPlan,
    required this.todayPlanSum,
    required this.factBeforeToday,
    required this.monthRemainingBeforeToday,
    required this.carryForwardSum,
    this.surplusSum = 0,
    this.vsYesterdayPct,
    required this.days,
  });

  factory AgentKpiDailyRoute.empty() => const AgentKpiDailyRoute(
        workingDaysTotal: 0,
        remainingWorkingDays: 0,
        pastWorkingDays: 0,
        baseDayPlan: 0,
        todayPlanSum: 0,
        factBeforeToday: 0,
        monthRemainingBeforeToday: 0,
        carryForwardSum: 0,
        surplusSum: 0,
        days: [],
      );

  factory AgentKpiDailyRoute.fromJson(Map<String, dynamic>? j) {
    if (j == null) return AgentKpiDailyRoute.empty();
    final todayPlan = _parseMobileNum(j['today_plan_sum']);
    final days = (j['days'] as List? ?? [])
        .whereType<Map>()
        .map((e) {
          final day = AgentKpiDailyRouteDay.fromJson(Map<String, dynamic>.from(e));
          // Bugun + kelajak: API eski bo‘lsa ham teng ulush (today_plan_sum).
          if (day.isWorkingDay && (day.isToday || day.isFuture)) {
            final plan = todayPlan;
            final rem = day.isFuture
                ? plan
                : (plan - day.factSum).clamp(0.0, double.infinity);
            final over = day.isFuture ? 0.0 : (day.factSum - plan).clamp(0.0, double.infinity);
            return AgentKpiDailyRouteDay(
              date: day.date,
              isWorkingDay: day.isWorkingDay,
              isToday: day.isToday,
              isFuture: day.isFuture,
              planSum: plan,
              factSum: day.factSum,
              executionPct: plan > 0 && !day.isFuture
                  ? (day.factSum / plan) * 100
                  : (day.isFuture ? null : day.executionPct),
              remainingSum: rem.toDouble(),
              overSum: over.toDouble(),
              carryIn: day.isToday ? day.carryIn : 0,
              status: day.isFuture
                  ? 'pending'
                  : (over > 0
                      ? 'over'
                      : (plan > 0 && day.factSum >= plan
                          ? 'done'
                          : (day.factSum > 0 ? 'warn' : day.status))),
            );
          }
          return day;
        })
        .toList();
    return AgentKpiDailyRoute(
      workingDaysTotal: (j['working_days_total'] as num?)?.toInt() ?? 0,
      remainingWorkingDays: (j['remaining_working_days'] as num?)?.toInt() ?? 0,
      pastWorkingDays: (j['past_working_days'] as num?)?.toInt() ?? 0,
      baseDayPlan: _parseMobileNum(j['base_day_plan']),
      todayPlanSum: todayPlan,
      factBeforeToday: _parseMobileNum(j['fact_before_today']),
      monthRemainingBeforeToday: _parseMobileNum(j['month_remaining_before_today']),
      carryForwardSum: _parseMobileNum(j['carry_forward_sum']),
      surplusSum: _parseMobileNum(j['surplus_sum']),
      vsYesterdayPct: (j['vs_yesterday_pct'] as num?)?.toDouble(),
      days: days,
    );
  }
}

class AgentKpiTimesheetBlock {
  final double? coefficient;
  final int activeDays;
  final int excusedDays;
  final int inactiveDays;
  final int offDays;
  final double workedDays;
  final double salesTotal;
  final int visitsTotal;

  const AgentKpiTimesheetBlock({
    this.coefficient,
    required this.activeDays,
    required this.excusedDays,
    required this.inactiveDays,
    required this.offDays,
    required this.workedDays,
    required this.salesTotal,
    required this.visitsTotal,
  });

  factory AgentKpiTimesheetBlock.empty() => const AgentKpiTimesheetBlock(
        activeDays: 0,
        excusedDays: 0,
        inactiveDays: 0,
        offDays: 0,
        workedDays: 0,
        salesTotal: 0,
        visitsTotal: 0,
      );

  factory AgentKpiTimesheetBlock.fromJson(Map<String, dynamic>? j) {
    if (j == null) return AgentKpiTimesheetBlock.empty();
    return AgentKpiTimesheetBlock(
      coefficient: (j['coefficient'] as num?)?.toDouble(),
      activeDays: (j['active_days'] as num?)?.toInt() ?? 0,
      excusedDays: (j['excused_days'] as num?)?.toInt() ?? 0,
      inactiveDays: (j['inactive_days'] as num?)?.toInt() ?? 0,
      offDays: (j['off_days'] as num?)?.toInt() ?? 0,
      workedDays: _parseMobileNum(j['worked_days']),
      salesTotal: _parseMobileNum(j['sales_total']),
      visitsTotal: (j['visits_total'] as num?)?.toInt() ?? 0,
    );
  }
}

class AgentKpiResult {
  final String month;
  final String today;
  final int year;
  final int monthNum;
  final int daysInMonth;
  final int dayOfMonth;
  final int agentId;
  final String agentName;
  final String? agentCode;
  final double todaySalesSum;
  final double todayPlanDaySum;
  final double todayBasePlanDaySum;
  final double? todayExecutionPct;
  final double todayRemainingSum;
  final double? todayVsYesterdayPct;
  final int todayVisits;
  final int todayOrdersCount;
  final double todayVolumeQty;
  final int? skuFocusFact;
  final int? skuFocusPlan;
  final String? skuFocusLabel;
  final double monthPlanSum;
  final double monthFactSum;
  final double? monthExecutionPct;
  final double monthRemainingSum;
  final double? forecastPct;
  final bool hasPlans;
  final AgentKpiDailyRoute dailyRoute;
  final List<AgentKpiGroupRow> kpiGroups;
  final List<AgentKpiWeekDay> week;
  final AgentKpiTimesheetBlock timesheet;
  final bool bonusAvailable;
  final String planSource;

  const AgentKpiResult({
    required this.month,
    required this.today,
    required this.year,
    required this.monthNum,
    required this.daysInMonth,
    required this.dayOfMonth,
    required this.agentId,
    required this.agentName,
    this.agentCode,
    required this.todaySalesSum,
    required this.todayPlanDaySum,
    this.todayBasePlanDaySum = 0,
    this.todayExecutionPct,
    required this.todayRemainingSum,
    this.todayVsYesterdayPct,
    required this.todayVisits,
    required this.todayOrdersCount,
    required this.todayVolumeQty,
    this.skuFocusFact,
    this.skuFocusPlan,
    this.skuFocusLabel,
    required this.monthPlanSum,
    required this.monthFactSum,
    this.monthExecutionPct,
    required this.monthRemainingSum,
    this.forecastPct,
    required this.hasPlans,
    this.dailyRoute = const AgentKpiDailyRoute(
      workingDaysTotal: 0,
      remainingWorkingDays: 0,
      pastWorkingDays: 0,
      baseDayPlan: 0,
      todayPlanSum: 0,
      factBeforeToday: 0,
      monthRemainingBeforeToday: 0,
      carryForwardSum: 0,
      days: [],
    ),
    required this.kpiGroups,
    required this.week,
    required this.timesheet,
    required this.bonusAvailable,
    required this.planSource,
  });

  factory AgentKpiResult.empty() => const AgentKpiResult(
        month: '',
        today: '',
        year: 0,
        monthNum: 0,
        daysInMonth: 0,
        dayOfMonth: 0,
        agentId: 0,
        agentName: '',
        todaySalesSum: 0,
        todayPlanDaySum: 0,
        todayRemainingSum: 0,
        todayVisits: 0,
        todayOrdersCount: 0,
        todayVolumeQty: 0,
        monthPlanSum: 0,
        monthFactSum: 0,
        monthRemainingSum: 0,
        hasPlans: false,
        kpiGroups: [],
        week: [],
        timesheet: AgentKpiTimesheetBlock(
          activeDays: 0,
          excusedDays: 0,
          inactiveDays: 0,
          offDays: 0,
          workedDays: 0,
          salesTotal: 0,
          visitsTotal: 0,
        ),
        bonusAvailable: false,
        planSource: '',
      );

  factory AgentKpiResult.fromJson(Map<String, dynamic> j) {
    final period = j['period'] is Map ? Map<String, dynamic>.from(j['period'] as Map) : <String, dynamic>{};
    final agent = j['agent'] is Map ? Map<String, dynamic>.from(j['agent'] as Map) : <String, dynamic>{};
    final today = j['today'] is Map ? Map<String, dynamic>.from(j['today'] as Map) : <String, dynamic>{};
    final month = j['month'] is Map ? Map<String, dynamic>.from(j['month'] as Map) : <String, dynamic>{};
    final notes = j['notes'] is Map ? Map<String, dynamic>.from(j['notes'] as Map) : <String, dynamic>{};
    final sku = today['sku_focus'];
    final skuMap = sku is Map ? Map<String, dynamic>.from(sku) : null;
    final groups = (j['kpi_groups'] as List? ?? [])
        .whereType<Map>()
        .map((e) => AgentKpiGroupRow.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    final week = (j['week'] as List? ?? [])
        .whereType<Map>()
        .map((e) => AgentKpiWeekDay.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    return AgentKpiResult(
      month: period['month']?.toString() ?? '',
      today: period['today']?.toString() ?? '',
      year: (period['year'] as num?)?.toInt() ?? 0,
      monthNum: (period['month_num'] as num?)?.toInt() ?? 0,
      daysInMonth: (period['days_in_month'] as num?)?.toInt() ?? 0,
      dayOfMonth: (period['day_of_month'] as num?)?.toInt() ?? 0,
      agentId: (agent['id'] as num?)?.toInt() ?? 0,
      agentName: agent['name']?.toString() ?? '',
      agentCode: agent['code']?.toString(),
      todaySalesSum: _parseMobileNum(today['sales_sum']),
      todayPlanDaySum: _parseMobileNum(today['plan_day_sum']),
      todayBasePlanDaySum: _parseMobileNum(today['base_plan_day_sum']),
      todayExecutionPct: (today['execution_pct'] as num?)?.toDouble(),
      todayRemainingSum: _parseMobileNum(today['remaining_sum']),
      todayVsYesterdayPct: (today['vs_yesterday_pct'] as num?)?.toDouble(),
      todayVisits: (today['visits'] as num?)?.toInt() ?? 0,
      todayOrdersCount: (today['orders_count'] as num?)?.toInt() ?? 0,
      todayVolumeQty: _parseMobileNum(today['volume_qty']),
      skuFocusFact: (skuMap?['fact'] as num?)?.toInt(),
      skuFocusPlan: (skuMap?['plan'] as num?)?.toInt(),
      skuFocusLabel: skuMap?['label']?.toString(),
      monthPlanSum: _parseMobileNum(month['plan_sum']),
      monthFactSum: _parseMobileNum(month['fact_sum']),
      monthExecutionPct: (month['execution_pct'] as num?)?.toDouble(),
      monthRemainingSum: _parseMobileNum(month['remaining_sum']),
      forecastPct: (month['forecast_pct'] as num?)?.toDouble(),
      hasPlans: month['has_plans'] == true,
      dailyRoute: AgentKpiDailyRoute.fromJson(
        j['daily_route'] is Map ? Map<String, dynamic>.from(j['daily_route'] as Map) : null,
      ),
      kpiGroups: groups,
      week: week,
      timesheet: AgentKpiTimesheetBlock.fromJson(
        j['timesheet'] is Map ? Map<String, dynamic>.from(j['timesheet'] as Map) : null,
      ),
      bonusAvailable: notes['bonus_available'] == true,
      planSource: notes['plan_source']?.toString() ?? '',
    );
  }
}

class DebtorClient {
  final int id;
  final String name;
  final String? phone;
  final String? clientCode;
  final double balance;
  final String? overdueAt;
  final double legacyDebt;
  final double currentDebt;
  final bool debtCollectionOnly;

  DebtorClient({
    required this.id,
    required this.name,
    this.phone,
    this.clientCode,
    required this.balance,
    this.overdueAt,
    this.legacyDebt = 0,
    this.currentDebt = 0,
    this.debtCollectionOnly = false,
  });

  factory DebtorClient.fromJson(Map<String, dynamic> j) => DebtorClient(
        id: (j['id'] as num).toInt(),
        name: j['name']?.toString() ?? '',
        phone: j['phone']?.toString(),
        clientCode: j['client_code']?.toString(),
        balance: (j['balance'] as num?)?.toDouble() ?? 0,
        overdueAt: j['overdue_at']?.toString(),
        legacyDebt: (j['legacy_debt'] as num?)?.toDouble() ?? 0,
        currentDebt: (j['current_debt'] as num?)?.toDouble() ?? 0,
        debtCollectionOnly: j['debt_collection_only'] == true,
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
  final int? clientId;
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
    this.clientId,
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
      clientId: (j['client_id'] as num?)?.toInt(),
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
