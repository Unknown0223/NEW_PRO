import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';

class CoverApi {
  final Dio _dio;
  CoverApi(this._dio);

  Future<Map<String, dynamic>?> active(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/cover/active');
      final data = (r.data as Map)['data'];
      if (data == null) return null;
      return Map<String, dynamic>.from(data as Map);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<Map<String, dynamic>>> list(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/cover');
      final data = (r.data as Map)['data'];
      if (data is! List) return [];
      return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> create(
    String slug, {
    int? agentUserId,
    int? svrUserId,
    String? coverDate,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/cover',
        data: {
          if (agentUserId != null && agentUserId > 0)
            'agent_user_id': agentUserId,
          if (svrUserId != null && svrUserId > 0) 'svr_user_id': svrUserId,
          if (coverDate != null) 'cover_date': coverDate,
        },
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> markFace(
    String slug,
    int id, {
    required bool faceOk,
  }) async {
    try {
      final r = await _dio.post(
        '/api/$slug/mobile/cover/$id/face',
        data: {'face_ok': faceOk},
      );
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> accept(String slug, int id) async {
    try {
      final r = await _dio.post('/api/$slug/mobile/cover/$id/accept');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Map<String, dynamic>> end(String slug, int id) async {
    try {
      final r = await _dio.post('/api/$slug/mobile/cover/$id/end');
      return Map<String, dynamic>.from((r.data as Map)['data'] as Map? ?? {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

final coverApiProvider = Provider<CoverApi>((ref) {
  return CoverApi(ref.watch(dioProvider));
});
