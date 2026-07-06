import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../time/server_clock.dart';
import '../time/work_region_time.dart';
import 'api_exceptions.dart';
import 'dio_client.dart';

/// Field API — GPS locations, agent visits, route days
/// Source: backend/src/modules/field/field.route.ts
class FieldApi {
  final Dio _dio;
  FieldApi(this._dio);

  /// POST /api/{slug}/agent-locations
  /// Send GPS ping to server
  Future<void> sendLocation(
    String slug, {
    required double latitude,
    required double longitude,
    double? accuracyMeters,
  }) async {
    try {
      final response = await _dio.post('/api/$slug/agent-locations', data: {
        'latitude': latitude,
        'longitude': longitude,
        if (accuracyMeters != null) 'accuracy_meters': accuracyMeters,
      },);
      // Serverdan kelgan joylashuv yozuvi vaqtidan (recorded_at) ishonchli
      // soatni langarlaymiz — sinxron oynasi qurilma soatiga tayanmasin.
      final raw = response.data;
      if (raw is Map) {
        final data = raw['data'];
        final recordedAt = data is Map ? data['recorded_at']?.toString() : null;
        final serverUtc = parseUtcIso(recordedAt);
        if (serverUtc != null) {
          ServerClock.instance.anchorFromServerUtc(serverUtc);
        }
      }
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// GET /api/{slug}/agent-locations
  /// Get agent locations (for supervisor map)
  Future<List<Map<String, dynamic>>> getLocations(
    String slug, {
    int? agentId,
    String? from,
    String? to,
  }) async {
    try {
      final response = await _dio.get(
        '/api/$slug/agent-locations',
        queryParameters: {
          if (agentId != null) 'agent_id': agentId,
          if (from != null) 'from': from,
          if (to != null) 'to': to,
        },
      );
      return (response.data as List?)?.cast<Map<String, dynamic>>() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// POST /api/{slug}/agent-visits
  /// Create a visit record
  Future<Map<String, dynamic>> createVisit(
    String slug, {
    int? clientId,
    double? latitude,
    double? longitude,
    String? notes,
    String? refusalReasonRef,
  }) async {
    try {
      final response = await _dio.post(
        '/api/$slug/agent-visits',
        data: {
          if (clientId != null) 'client_id': clientId,
          if (latitude != null) 'latitude': latitude,
          if (longitude != null) 'longitude': longitude,
          if (notes != null) 'notes': notes,
          if (refusalReasonRef != null && refusalReasonRef.isNotEmpty)
            'refusal_reason_ref': refusalReasonRef,
        },
      );
      final raw = response.data;
      if (raw is Map<String, dynamic>) {
        final inner = raw['data'];
        if (inner is Map) return Map<String, dynamic>.from(inner);
        return raw;
      }
      return {};
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// GET /api/{slug}/agent-route-days
  /// Get route days list
  Future<List<Map<String, dynamic>>> getRouteDays(
    String slug, {
    int? agentId,
    String? from,
    String? to,
  }) async {
    try {
      final response = await _dio.get(
        '/api/$slug/agent-route-days',
        queryParameters: {
          if (agentId != null) 'agent_id': agentId,
          if (from != null) 'from': from,
          if (to != null) 'to': to,
        },
      );
      return (response.data as List?)?.cast<Map<String, dynamic>>() ?? [];
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  /// GET /api/{slug}/agent-route-days/one — agent marshruti (sana bo‘yicha).
  Future<Map<String, dynamic>?> getTodayRoute(
    String slug, {
    int? agentId,
    String? routeDate,
  }) async {
    try {
      final date = routeDate ?? serverTodayKey();
      final response = await _dio.get(
        '/api/$slug/agent-route-days/one',
        queryParameters: {
          if (agentId != null) 'agent_id': agentId,
          'route_date': date,
        },
      );
      final raw = response.data;
      if (raw is Map<String, dynamic>) {
        final inner = raw['data'];
        if (inner is Map) return Map<String, dynamic>.from(inner);
        if (inner == null) return null;
        if (raw.containsKey('stops')) return raw;
      }
      return null;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw _map(e);
    }
  }

  /// PUT /api/{slug}/agent-route-days
  /// Update route day
  Future<void> updateRouteDay(
    String slug, {
    required int agentId,
    required String routeDate,
    required List<Map<String, dynamic>> stops,
    String? notes,
  }) async {
    try {
      await _dio.put('/api/$slug/agent-route-days', data: {
        'agent_id': agentId,
        'route_date': routeDate,
        'stops': stops,
        if (notes != null) 'notes': notes,
      },);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  ApiException _map(DioException e) {
    return mapDioException(e);
  }
}

final fieldApiProvider = Provider<FieldApi>((ref) {
  return FieldApi(ref.read(dioProvider));
});
