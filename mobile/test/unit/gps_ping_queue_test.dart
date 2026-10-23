import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/gps/gps_ping_queue.dart';

void main() {
  group('shouldEnqueueGpsPing', () {
    double dist(double a, double b, double c, double d) =>
        ((a - c).abs() + (b - d).abs()) * 111000;

    test('always when no min distance', () {
      expect(
        shouldEnqueueGpsPing(
          lat: 41.3,
          lng: 69.2,
          lastLat: 41.3,
          lastLng: 69.2,
          minDistanceM: null,
          distanceMeters: dist,
        ),
        isTrue,
      );
    });

    test('true when no last point', () {
      expect(
        shouldEnqueueGpsPing(
          lat: 41.3,
          lng: 69.2,
          lastLat: null,
          lastLng: null,
          minDistanceM: 50,
          distanceMeters: dist,
        ),
        isTrue,
      );
    });

    test('false when moved less than min', () {
      expect(
        shouldEnqueueGpsPing(
          lat: 41.3001,
          lng: 69.2,
          lastLat: 41.3,
          lastLng: 69.2,
          minDistanceM: 50,
          distanceMeters: dist,
        ),
        isFalse,
      );
    });
  });

  group('PendingLocationPing.toApiJson', () {
    test('includes recorded_at UTC', () {
      final json = PendingLocationPing(
        latitude: 41.3,
        longitude: 69.2,
        accuracyMeters: 12,
        recordedAt: DateTime.utc(2026, 9, 5, 10, 0),
      ).toApiJson();
      expect(json['latitude'], 41.3);
      expect(json['recorded_at'], '2026-09-05T10:00:00.000Z');
      expect(json['accuracy_meters'], 12);
    });
  });
}
