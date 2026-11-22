import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/dio_client.dart';
import '../../core/auth/session.dart';
import 'attendance_models.dart';
import 'attendance_offline_queue.dart';

class AttendanceApiService {
  final Dio _dio;
  final String _slug;

  AttendanceApiService(this._dio, this._slug);

  Future<MobileAttendanceState> fetchState() async {
    final r = await _dio.get('/api/$_slug/mobile/attendance/state');
    final data = r.data is Map && (r.data as Map)['data'] is Map
        ? Map<String, dynamic>.from((r.data as Map)['data'] as Map)
        : <String, dynamic>{};
    return MobileAttendanceState.fromJson(data);
  }

  Future<Map<String, dynamic>?> fetchMyTimesheet({String? month}) async {
    final r = await _dio.get(
      '/api/$_slug/mobile/attendance/my-timesheet',
      queryParameters: {if (month != null) 'month': month},
    );
    final data = r.data is Map && (r.data as Map)['data'] is Map
        ? Map<String, dynamic>.from((r.data as Map)['data'] as Map)
        : <String, dynamic>{};
    return data['row'] is Map ? Map<String, dynamic>.from(data['row'] as Map) : null;
  }

  Future<int?> fetchDayCode() async {
    final r = await _dio.get('/api/$_slug/mobile/attendance/day-code');
    final data = r.data is Map && (r.data as Map)['data'] is Map
        ? Map<String, dynamic>.from((r.data as Map)['data'] as Map)
        : <String, dynamic>{};
    return (data['day_code'] as num?)?.toInt();
  }

  FormData _punchForm(Map<String, dynamic> fields, {MultipartFile? photoFront, MultipartFile? photoBack, MultipartFile? videoFront, MultipartFile? videoBack}) {
    return FormData.fromMap({
      ...fields,
      if (photoFront != null) 'photo_front': photoFront,
      if (photoBack != null) 'photo_back': photoBack,
      if (videoFront != null) 'video_front': videoFront,
      if (videoBack != null) 'video_back': videoBack,
    });
  }

  Future<Map<String, dynamic>> submitPhotoPunch({
    required double lat,
    required double lng,
    required double accuracyM,
    required bool isMockLocation,
    required List<String> livenessSteps,
    required String photoFrontBase64,
    String? photoBackBase64,
    String? comment,
    bool fromGallery = false,
    int? faceCount,
  }) async {
    final r = await _dio.post(
      '/api/$_slug/mobile/attendance/punch',
      data: _punchForm(
        {
          'source': 'mobile_photo',
          'lat': lat,
          'lng': lng,
          'accuracy_m': accuracyM,
          'is_mock_location': isMockLocation,
          'client_timestamp': DateTime.now().toUtc().toIso8601String(),
          'from_gallery': fromGallery,
          'face_count': faceCount ?? 1,
          'liveness_steps': jsonEncode(livenessSteps),
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        },
        photoFront: MultipartFile.fromBytes(base64Decode(photoFrontBase64), filename: 'front.jpg'),
        photoBack: photoBackBase64 == null
            ? null
            : MultipartFile.fromBytes(base64Decode(photoBackBase64), filename: 'back.jpg'),
      ),
    );
    return r.data is Map ? Map<String, dynamic>.from(r.data as Map) : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> submitVideoPunch({
    required double lat,
    required double lng,
    required double accuracyM,
    required bool isMockLocation,
    required int durationSec,
    required int spokenCode,
    required String captureMode,
    required String videoFrontBase64,
    String? videoBackBase64,
    String? comment,
    bool fromGallery = false,
  }) async {
    final r = await _dio.post(
      '/api/$_slug/mobile/attendance/video-punch',
      data: _punchForm(
        {
          'source': 'mobile_video',
          'lat': lat,
          'lng': lng,
          'accuracy_m': accuracyM,
          'is_mock_location': isMockLocation,
          'client_timestamp': DateTime.now().toUtc().toIso8601String(),
          'from_gallery': fromGallery,
          'duration_sec': durationSec,
          'spoken_code': spokenCode,
          'capture_mode': captureMode,
          if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
        },
        videoFront: MultipartFile.fromBytes(base64Decode(videoFrontBase64), filename: 'front.mp4'),
        videoBack: videoBackBase64 == null
            ? null
            : MultipartFile.fromBytes(base64Decode(videoBackBase64), filename: 'back.mp4'),
      ),
    );
    return r.data is Map ? Map<String, dynamic>.from(r.data as Map) : <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> fetchKioskTeam() async {
    final r = await _dio.get('/api/$_slug/mobile/attendance/kiosk-team');
    final data = r.data is Map && (r.data as Map)['data'] is Map
        ? Map<String, dynamic>.from((r.data as Map)['data'] as Map)
        : <String, dynamic>{};
    final list = data['members'] is List ? data['members'] as List : const [];
    return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<Map<String, dynamic>> submitKioskPunch({
    required int targetUserId,
    required double lat,
    required double lng,
    required double accuracyM,
    required String photoFrontBase64,
  }) async {
    final r = await _dio.post(
      '/api/$_slug/mobile/attendance/kiosk-punch',
      data: _punchForm(
        {
          'target_user_id': targetUserId,
          'lat': lat,
          'lng': lng,
          'accuracy_m': accuracyM,
        },
        photoFront: MultipartFile.fromBytes(base64Decode(photoFrontBase64), filename: 'kiosk.jpg'),
      ),
    );
    return r.data is Map ? Map<String, dynamic>.from(r.data as Map) : <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> fetchMyRequests() async {
    final r = await _dio.get('/api/$_slug/mobile/attendance/my-requests');
    final data = r.data is Map && (r.data as Map)['data'] is Map
        ? Map<String, dynamic>.from((r.data as Map)['data'] as Map)
        : <String, dynamic>{};
    final list = data['items'] is List ? data['items'] as List : const [];
    return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
  }

  Future<void> createMyRequest({
    required String type,
    required String fromDate,
    required String toDate,
    double? hours,
    String? reason,
  }) async {
    await _dio.post(
      '/api/$_slug/mobile/attendance/my-requests',
      data: {
        'type': type,
        'from_date': fromDate,
        'to_date': toDate,
        if (hours != null) 'hours': hours,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
  }

  Future<int> flushOfflineQueue() async {
    final pending = await AttendanceOfflineQueue.pending();
    var sent = 0;
    for (final row in pending) {
      try {
        final kind = row['kind']?.toString();
        if (kind == 'photo') {
          await submitPhotoPunch(
            lat: (row['lat'] as num).toDouble(),
            lng: (row['lng'] as num).toDouble(),
            accuracyM: (row['accuracy_m'] as num).toDouble(),
            isMockLocation: row['is_mock_location'] == true,
            livenessSteps: (row['liveness_steps'] as List? ?? const []).map((e) => e.toString()).toList(),
            photoFrontBase64: await _fileToB64(row['photo_front_path']?.toString()),
            photoBackBase64: await _fileToB64OrNull(row['photo_back_path']?.toString()),
            comment: row['comment']?.toString(),
          );
        } else if (kind == 'video') {
          await submitVideoPunch(
            lat: (row['lat'] as num).toDouble(),
            lng: (row['lng'] as num).toDouble(),
            accuracyM: (row['accuracy_m'] as num).toDouble(),
            isMockLocation: row['is_mock_location'] == true,
            durationSec: (row['duration_sec'] as num?)?.toInt() ?? 8,
            spokenCode: (row['spoken_code'] as num?)?.toInt() ?? 0,
            captureMode: row['capture_mode']?.toString() ?? 'sequential',
            videoFrontBase64: await _fileToB64(row['video_front_path']?.toString()),
            videoBackBase64: await _fileToB64OrNull(row['video_back_path']?.toString()),
            comment: row['comment']?.toString(),
          );
        } else {
          continue;
        }
        final qf = row['_queue_file']?.toString();
        if (qf != null) await AttendanceOfflineQueue.remove(qf);
        sent += 1;
      } catch (_) {}
    }
    return sent;
  }

  Future<String> _fileToB64(String? path) async {
    if (path == null || path.isEmpty) return '';
    return base64Encode(await File(path).readAsBytes());
  }

  Future<String?> _fileToB64OrNull(String? path) async {
    if (path == null || path.isEmpty) return null;
    final f = File(path);
    if (!await f.exists()) return null;
    return base64Encode(await f.readAsBytes());
  }
}

final attendanceApiProvider = Provider<AttendanceApiService>((ref) {
  final dio = ref.watch(dioProvider);
  final slug = ref.watch(sessionProvider).tenantSlug ?? 'aksit';
  return AttendanceApiService(dio, slug);
});

final mobileAttendanceStateProvider = FutureProvider.autoDispose<MobileAttendanceState>((ref) {
  return ref.watch(attendanceApiProvider).fetchState();
});
