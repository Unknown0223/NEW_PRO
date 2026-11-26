import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';

class ExpeditorShareApi {
  final Dio _dio;
  ExpeditorShareApi(this._dio);

  Future<List<Map<String, dynamic>>> list(
    String slug, {
    required String box,
  }) async {
    try {
      final r = await _dio.get(
        '/api/$slug/mobile/expeditor/share',
        queryParameters: {'box': box},
      );
      final data = (r.data as Map)['data'];
      if (data is! List) return [];
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> get(String slug, int id) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/share/$id');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<Map<String, dynamic>>> listRecipients(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/expeditor/share/recipients');
      final data = (r.data as Map)['data'];
      if (data is! List) return [];
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> create(
    String slug, {
    required List<int> orderIds,
    required int receiverUserId,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/share',
        data: {
          'order_ids': orderIds,
          'receiver_user_id': receiverUserId,
        },
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> accept(
    String slug,
    int id, {
    required List<int> orderIds,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/share/$id/accept',
        data: {'order_ids': orderIds},
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<String> uploadHandoffPhoto(
    String slug,
    int id, {
    required String imageBase64,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/share/$id/handoff-photo',
        data: {'image_base64': imageBase64},
      );
      final data = Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
      final key = data['photo_key']?.toString() ?? '';
      if (key.isEmpty) {
        throw const ApiException(message: 'SHARE_PHOTO_UPLOAD_FAILED');
      }
      return key;
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> handoff(
    String slug,
    int id, {
    required double lat,
    required double lng,
    required String photoKey,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/share/$id/handoff',
        data: {'lat': lat, 'lng': lng, 'photo_key': photoKey},
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> requestReturn(String slug, int id) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/share/$id/return-request',
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> acceptReturn(String slug, int id) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/expeditor/share/$id/return-accept',
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

final expeditorShareApiProvider = Provider<ExpeditorShareApi>((ref) {
  return ExpeditorShareApi(ref.watch(dioProvider));
});
