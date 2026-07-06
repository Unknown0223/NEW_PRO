import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_exceptions.dart';
import 'dio_client.dart';

class PermissionsApi {
  final Dio _dio;
  PermissionsApi(this._dio);

  Future<List<String>> getMyPermissions(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/access/me-permissions');
      final data = r.data;
      if (data is Map && data['data'] is Map) {
        final keys = data['data']['keys'];
        if (keys is List) return keys.cast<String>();
      }
      return [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  ApiException _map(DioException e) {
    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout) {
      return const NetworkException();
    }
    return mapDioException(e, extraCodes: const {
      'TenantNotFound': 'Неверный код компании',
    },);
  }
}

final permissionsApiProvider = Provider<PermissionsApi>((ref) => PermissionsApi(ref.read(dioProvider)));
