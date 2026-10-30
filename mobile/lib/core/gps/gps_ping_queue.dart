/// GPS oflayn navbat — pure qoidalar + flush helper.
library;

import '../api/field_api.dart';
import '../database/app_database.dart';

class PendingLocationPing {
  final int? id;
  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final int? batteryPct;
  final String? networkType;
  final DateTime recordedAt;

  const PendingLocationPing({
    this.id,
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.batteryPct,
    this.networkType,
    required this.recordedAt,
  });

  Map<String, dynamic> toApiJson() => {
        'latitude': latitude,
        'longitude': longitude,
        if (accuracyMeters != null) 'accuracy_meters': accuracyMeters,
        if (batteryPct != null) 'battery_pct': batteryPct,
        if (networkType != null && networkType!.isNotEmpty) 'network_type': networkType,
        'recorded_at': recordedAt.toUtc().toIso8601String(),
      };
}

/// min_distance: faqat enqueue uchun (HTTP muvaffaqiyatidan oldin).
bool shouldEnqueueGpsPing({
  required double lat,
  required double lng,
  required double? lastLat,
  required double? lastLng,
  required num? minDistanceM,
  required double Function(double, double, double, double) distanceMeters,
}) {
  if (minDistanceM == null || minDistanceM <= 0) return true;
  if (lastLat == null || lastLng == null) return true;
  final moved = distanceMeters(lastLat, lastLng, lat, lng);
  return moved >= minDistanceM;
}

/// Batch hajmi — server max 200.
const gpsPingFlushBatchSize = 50;

/// SQLite → server batch. Internet yo‘q bo‘lsa exception → retry keyinroq.
Future<int> flushPendingLocationPingsToServer({
  required AppDatabase db,
  required FieldApi fieldApi,
  required String slug,
  bool Function()? isCancelled,
}) async {
  if (slug.isEmpty) return 0;
  var totalSent = 0;
  while (isCancelled?.call() != true) {
    final rows = await db.getPendingLocationPings(limit: gpsPingFlushBatchSize);
    if (rows.isEmpty) break;

    final ids = <int>[];
    final pings = <Map<String, dynamic>>[];
    for (final row in rows) {
      final id = row['id'] as int?;
      if (id == null) continue;
      ids.add(id);
      final recordedRaw = row['recorded_at']?.toString();
      final recordedAt = recordedRaw != null ? DateTime.tryParse(recordedRaw) : null;
      pings.add(
        PendingLocationPing(
          id: id,
          latitude: (row['latitude'] as num).toDouble(),
          longitude: (row['longitude'] as num).toDouble(),
          accuracyMeters: (row['accuracy_meters'] as num?)?.toDouble(),
          batteryPct: (row['battery_pct'] as num?)?.toInt(),
          networkType: row['network_type']?.toString(),
          recordedAt: (recordedAt ?? DateTime.now()).toUtc(),
        ).toApiJson(),
      );
    }
    if (pings.isEmpty) break;

    try {
      await fieldApi.sendLocationBatch(slug, pings: pings);
      await db.deletePendingLocationPings(ids);
      totalSent += ids.length;
    } catch (_) {
      await db.bumpPendingLocationPingRetries(ids);
      rethrow;
    }
  }
  return totalSent;
}
