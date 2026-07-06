import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api_exceptions.dart';
import 'dio_client.dart';

class SupervisorApi {
  final Dio _dio;
  SupervisorApi(this._dio);

  Future<Map<String, dynamic>> getSummary(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/summary');
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getVisits(String slug, {int page = 1, int limit = 50, String? date}) async {
    try {
      final qp = <String, dynamic>{'page': page, 'limit': limit};
      if (date != null && date.isNotEmpty) qp['date'] = date;
      final r = await _dio.get(
        '/api/$slug/mobile/supervisor/visits',
        queryParameters: qp,
      );
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<Map<String, dynamic>> getProducts(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/products');
      return r.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  Future<List<AgentLocationPin>> getAgentLocations(String slug) async {
    try {
      final r = await _dio.get('/api/$slug/mobile/supervisor/agent-locations');
      final list = r.data['data'] as List? ?? [];
      return list
          .map((e) => AgentLocationPin.fromJson(e as Map<String, dynamic>))
          .toList();
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

final supervisorApiProvider = Provider<SupervisorApi>((ref) => SupervisorApi(ref.read(dioProvider)));

class AgentLocationPin {
  final int agentId;
  final String? agentName;
  final double? latitude;
  final double? longitude;
  final String? recordedAt;

  AgentLocationPin({
    required this.agentId,
    this.agentName,
    this.latitude,
    this.longitude,
    this.recordedAt,
  });

  factory AgentLocationPin.fromJson(Map<String, dynamic> j) => AgentLocationPin(
    agentId: j['agent_id'] as int? ?? j['user_id'] as int? ?? 0,
    agentName: j['agent_name']?.toString() ?? j['name']?.toString() ?? '',
    latitude: (j['latitude'] as num?)?.toDouble(),
    longitude: (j['longitude'] as num?)?.toDouble(),
    recordedAt: j['recorded_at']?.toString() ?? j['created_at']?.toString(),
  );
}
