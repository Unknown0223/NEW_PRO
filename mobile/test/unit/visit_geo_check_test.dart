import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/mobile_config.dart';
import 'package:salesdoc_mobile/core/visits/visit_geo_check.dart';

void main() {
  const clientLat = 41.311081;
  const clientLng = 69.240562;

  test('radius: config bo‘lmasa standart 300 m', () {
    expect(resolveVisitRadiusM(null), defaultVisitRadiusM);
    expect(resolveVisitRadiusM(const MobileConfig()), defaultVisitRadiusM);
  });

  test('soxta GPS bloklanadi', () {
    final err = evaluateVisitPosition(
      latitude: clientLat,
      longitude: clientLng,
      accuracyM: 5,
      isMocked: true,
      radiusM: 300,
      clientLat: clientLat,
      clientLng: clientLng,
    );
    expect(err, contains('Fake GPS'));
  });

  test('aniqlik yetarli emas', () {
    final err = evaluateVisitPosition(
      latitude: clientLat,
      longitude: clientLng,
      accuracyM: 120,
      isMocked: false,
      radiusM: 300,
      clientLat: clientLat,
      clientLng: clientLng,
      maxAccuracyM: 50,
    );
    expect(err, contains('точность'));
  });

  test('radius ichida — ruxsat', () {
    final err = evaluateVisitPosition(
      latitude: clientLat + 0.001,
      longitude: clientLng,
      accuracyM: 10,
      isMocked: false,
      radiusM: 300,
      clientLat: clientLat,
      clientLng: clientLng,
    );
    expect(err, isNull);
  });

  test('radiusdan tashqarida — bloklanadi', () {
    final err = evaluateVisitPosition(
      latitude: clientLat + 0.01,
      longitude: clientLng,
      accuracyM: 10,
      isMocked: false,
      radiusM: 300,
      clientLat: clientLat,
      clientLng: clientLng,
    );
    expect(err, contains('далеко'));
  });

  test('mijoz koordinatasi yo‘q — faqat GPS sifati tekshiriladi', () {
    final err = evaluateVisitPosition(
      latitude: clientLat,
      longitude: clientLng,
      accuracyM: 10,
      isMocked: false,
      radiusM: 300,
    );
    expect(err, isNull);
  });
}
