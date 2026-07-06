import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';
import 'api_exceptions.dart';

class ClientQrApi {
  final Dio _dio;
  ClientQrApi(this._dio);

  Future<void> bind(String slug, {required String qrCode, required int clientId}) async {
    try {
      await _dio.post('/api/$slug/mobile/client-qr/bind', data: {
        'qr_code': qrCode.trim(),
        'client_id': clientId,
      });
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> unbind(String slug, {required String qrCode}) async {
    try {
      await _dio.post('/api/$slug/mobile/client-qr/unbind', data: {
        'qr_code': qrCode.trim(),
      });
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> recordStockSnapshot(String slug) async {
    try {
      await _dio.post('/api/$slug/mobile/stock-snapshot', data: {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

final clientQrApiProvider = Provider<ClientQrApi>((ref) => ClientQrApi(ref.watch(dioProvider)));
