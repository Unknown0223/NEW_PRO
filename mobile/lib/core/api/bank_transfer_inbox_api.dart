import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';

/// Bank Transfer Inbox — web kassa API (`/api/:slug/bank-transfer-inbox`).
class BankTransferInboxApi {
  final Dio _dio;
  BankTransferInboxApi(this._dio);

  Future<Map<String, int>> getCounts(String slug, {String? channel}) async {
    try {
      final r = await _dio.get(
        '/api/$slug/bank-transfer-inbox/counts',
        queryParameters: {
          if (channel != null && channel.trim().isNotEmpty) 'channel': channel.trim(),
        },
      );
      final data = r.data;
      if (data is Map && data['data'] is Map) {
        final m = Map<String, dynamic>.from(data['data'] as Map);
        return m.map((k, v) => MapEntry(k, (v as num?)?.toInt() ?? 0));
      }
      return {};
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<({List<Map<String, dynamic>> items, int total})> list(
    String slug, {
    String tab = 'unmatched',
    String? channel,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/bank-transfer-inbox',
        queryParameters: {
          'tab': tab,
          'page': page,
          'limit': limit,
          if (channel != null && channel.trim().isNotEmpty) 'channel': channel.trim(),
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        },
      );
      final raw = r.data;
      final list = <Map<String, dynamic>>[];
      var total = 0;
      if (raw is Map) {
        final data = raw['data'];
        if (data is List) {
          for (final e in data) {
            if (e is Map) list.add(Map<String, dynamic>.from(e));
          }
        }
        final meta = raw['meta'];
        if (meta is Map) total = (meta['total'] as num?)?.toInt() ?? list.length;
      }
      return (items: list, total: total);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> getDetail(String slug, int id) async {
    try {
      final r = await _dio.get('/api/$slug/bank-transfer-inbox/$id');
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> assign(
    String slug,
    int id, {
    required int clientId,
    required String comment,
    bool createPayment = true,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/bank-transfer-inbox/$id/assign',
        data: {
          'client_id': clientId,
          'comment': comment,
          'create_payment': createPayment,
        },
      );
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'COMMENT_REQUIRED': 'Комментарий обязателен (минимум 3 символа).',
        'ForbiddenPermission':
            'Нет права назначения (cash.perechisleniya.update).',
      },);
    }
  }

  Future<Map<String, dynamic>> reassign(
    String slug,
    int id, {
    required int clientId,
    required String comment,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/bank-transfer-inbox/$id/reassign',
        data: {
          'client_id': clientId,
          'comment': comment,
        },
      );
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'COMMENT_REQUIRED': 'Комментарий обязателен (минимум 3 символа).',
        'PAYMENT_CONFIRMED':
            'Нельзя переназначить: платёж уже подтверждён (409).',
        'ForbiddenPermission':
            'Нет права назначения (cash.perechisleniya.update).',
      },);
    }
  }

  Future<Map<String, dynamic>> comment(
    String slug,
    int id, {
    required String comment,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/bank-transfer-inbox/$id/comment',
        data: {'comment': comment},
      );
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'COMMENT_REQUIRED': 'Комментарий обязателен (минимум 3 символа).',
        'ForbiddenPermission':
            'Нет права (cash.perechisleniya.update).',
      },);
    }
  }

  /// Qo‘lda перечисление (source=manual) → pending to‘lov.
  Future<Map<String, dynamic>> createManual(
    String slug, {
    required double amount,
    required int clientId,
    required String comment,
    String? paidAt,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/bank-transfer-inbox/manual',
        data: {
          'amount': amount,
          'client_id': clientId,
          'comment': comment,
          if (paidAt != null && paidAt.trim().isNotEmpty) 'paid_at': paidAt.trim(),
          'create_payment': true,
        },
      );
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'BAD_CLIENT': 'Клиент не найден или неактивен.',
        'COMMENT_REQUIRED': 'Комментарий обязателен.',
        'ForbiddenPermission':
            'Нет права создания (cash.perechisleniya.create).',
      },);
    }
  }

  /// Matched yozuvdan pending to‘lov yaratish (web «Создать оплату»).
  Future<Map<String, dynamic>> createPayment(
    String slug,
    int id, {
    int? cashDeskId,
    String? paymentType,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/bank-transfer-inbox/$id/create-payment',
        data: {
          if (cashDeskId != null) 'cash_desk_id': cashDeskId,
          if (paymentType != null) 'payment_type': paymentType,
        },
      );
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'PAYMENT_EXISTS': 'Платёж уже создан.',
        'NO_CLIENT': 'Сначала назначьте клиента.',
        'BAD_STATUS': 'Недопустимый статус записи.',
        'ForbiddenPermission':
            'Нет права (cash.perechisleniya.update).',
      },);
    }
  }

  /// Keraksiz yozuvni ignore qilish.
  Future<Map<String, dynamic>> ignore(
    String slug,
    int id, {
    String? comment,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/bank-transfer-inbox/$id/ignore',
        data: {
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        },
      );
      return _unwrapData(r.data);
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'HAS_PENDING_PAYMENT':
            'Сначала отклоните или подтвердите связанный платёж.',
        'BAD_STATUS': 'Недопустимый статус записи.',
        'ForbiddenPermission':
            'Нет права (cash.perechisleniya.update).',
      },);
    }
  }

  /// Pending to‘lovni tasdiqlash — web bilan bir xil: `POST /payments/:id/confirm`.
  /// Inbox status `done` bo‘lishi uchun confirm dan keyin detail ni yangilang.
  Future<void> confirmPayment(String slug, int paymentId) async {
    try {
      await _dio.post('/api/$slug/payments/$paymentId/confirm', data: {});
    } on DioException catch (e) {
      throw mapDioException(e, extraCodes: const {
        'NotPending':
            'Платёж уже подтверждён или не в статусе ожидания (409).',
        'NotFound': 'Платёж не найден.',
        'PaymentVoided': 'Платёж аннулирован.',
        'ForbiddenPermission':
            'Нет права подтверждения оплаты (cash.oplaty_klientov.update).',
        'ForbiddenRole': 'Роль не позволяет подтверждать оплату.',
      },);
    }
  }

  /// Mijoz qidiruv (web katalog — lokal sync yo‘q).
  Future<List<Map<String, dynamic>>> searchClients(
    String slug, {
    String? search,
    int limit = 40,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/clients',
        queryParameters: {
          'page': 1,
          'limit': limit,
          'sort': 'name',
          'order': 'asc',
          'is_active': 'true',
          if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        },
      );
      final raw = r.data;
      if (raw is Map && raw['data'] is List) {
        return (raw['data'] as List)
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
      }
      return [];
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Map<String, dynamic> _unwrapData(dynamic raw) {
    if (raw is Map && raw['data'] is Map) {
      return Map<String, dynamic>.from(raw['data'] as Map);
    }
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return {};
  }
}

final bankTransferInboxApiProvider = Provider<BankTransferInboxApi>(
  (ref) => BankTransferInboxApi(ref.read(dioProvider)),
);
