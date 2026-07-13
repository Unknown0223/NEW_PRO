import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_client.dart';
import 'api_exceptions.dart';

class StockSnapshotApi {
  final Dio _dio;
  StockSnapshotApi(this._dio);

  Future<void> recordStockSnapshot(String slug) async {
    try {
      await _dio.post('/api/$slug/mobile/stock-snapshot', data: {});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}

final stockSnapshotApiProvider =
    Provider<StockSnapshotApi>((ref) => StockSnapshotApi(ref.watch(dioProvider)));
