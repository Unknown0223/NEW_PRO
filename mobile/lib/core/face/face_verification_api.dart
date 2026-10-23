import '../api/dio_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class FaceVerificationStatus {
  final bool enabled;
  final bool hasReference;
  final bool needsDailyLogin;

  const FaceVerificationStatus({
    required this.enabled,
    required this.hasReference,
    required this.needsDailyLogin,
  });

  factory FaceVerificationStatus.fromJson(Map<String, dynamic> j) {
    final policy = j['policy'] as Map<String, dynamic>? ?? {};
    return FaceVerificationStatus(
      enabled: policy['enabled'] == true,
      hasReference: j['has_reference'] == true,
      needsDailyLogin: j['needs_daily_login'] == true,
    );
  }
}

class FaceVerificationApi {
  final Ref _ref;
  FaceVerificationApi(this._ref);

  Future<FaceVerificationStatus> getStatus(String slug) async {
    final dio = _ref.read(dioProvider);
    final r = await dio.get('/api/$slug/mobile/me/face/status');
    return FaceVerificationStatus.fromJson(Map<String, dynamic>.from(r.data as Map));
  }

  Future<bool> checkRequired(
    String slug, {
    required String context,
    int? orderId,
    int? clientId,
  }) async {
    final dio = _ref.read(dioProvider);
    final r = await dio.post('/api/$slug/mobile/me/face/check-required', data: {
      'context': context,
      if (orderId != null) 'order_id': orderId,
      if (clientId != null) 'client_id': clientId,
    });
    final data = Map<String, dynamic>.from(r.data as Map);
    return data['required'] == true;
  }

  Future<void> uploadReference(String slug, String imageBase64) async {
    final dio = _ref.read(dioProvider);
    await dio.post('/api/$slug/mobile/me/face/reference', data: {
      'image_base64': imageBase64,
    });
  }

  Future<void> submitVerification(
    String slug, {
    required String context,
    required String imageBase64,
    int? orderId,
    int? clientId,
  }) async {
    final dio = _ref.read(dioProvider);
    await dio.post('/api/$slug/mobile/me/face/verify', data: {
      'context': context,
      'image_base64': imageBase64,
      if (orderId != null) 'order_id': orderId,
      if (clientId != null) 'client_id': clientId,
    });
  }
}

final faceVerificationApiProvider = Provider<FaceVerificationApi>((ref) {
  return FaceVerificationApi(ref);
});
