import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../config/mobile_config.dart';

/// Web sozlamada radius berilmagan bo‘lsa — vizit/zakaz uchun standart radius (backend bilan bir xil).
const double defaultVisitRadiusM = 300;

/// GPS aniqligi hisobiga qo‘shimcha masofa (maksimum).
const double maxVisitAccuracyToleranceM = 50;

double resolveVisitRadiusM(MobileConfig? config) {
  final r = config?.misc.requireWithinOutletRadiusM;
  return r != null && r > 0 ? r : defaultVisitRadiusM;
}

class VisitGeoResult {
  final Position? position;
  final String? error;
  final double? distanceM;
  final double radiusM;

  const VisitGeoResult({this.position, this.error, this.distanceM, required this.radiusM});

  bool get ok => error == null && position != null;
}

/// Sof tekshiruv (test uchun): soxta GPS, aniqlik, radius.
String? evaluateVisitPosition({
  required double latitude,
  required double longitude,
  required double accuracyM,
  required bool isMocked,
  required double radiusM,
  double? clientLat,
  double? clientLng,
  double? maxAccuracyM,
}) {
  if (isMocked) {
    return 'Обнаружена подмена геолокации (Fake GPS). Отключите программы подмены и режим разработчика.';
  }
  if (maxAccuracyM != null && maxAccuracyM > 0 && accuracyM > maxAccuracyM) {
    return 'Недостаточная точность GPS: ${accuracyM.round()} м (нужно ≤ ${maxAccuracyM.round()} м). '
        'Выйдите на открытое место.';
  }
  if (clientLat != null && clientLng != null) {
    final d = Geolocator.distanceBetween(latitude, longitude, clientLat, clientLng);
    final tolerance = accuracyM.clamp(0, maxVisitAccuracyToleranceM);
    if (d > radiusM + tolerance) {
      return 'Вы далеко от клиента: ${d.round()} м (допустимо ${radiusM.round()} м). '
          'Подойдите к торговой точке.';
    }
  }
  return null;
}

/// Vizit boshlash / zakaz tasdiqlashdan oldin to‘liq GPS tekshiruvi.
/// Eski (kesh) koordinata ishlatilmaydi — faqat yangi fix.
Future<VisitGeoResult> checkVisitGeo({
  required MobileConfig? config,
  double? clientLat,
  double? clientLng,
}) async {
  final radius = resolveVisitRadiusM(config);
  if (!await Geolocator.isLocationServiceEnabled()) {
    return VisitGeoResult(radiusM: radius, error: 'Геолокация выключена. Включите GPS.');
  }
  final perm = await Geolocator.checkPermission();
  if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
    return VisitGeoResult(radiusM: radius, error: 'Нет доступа к геолокации. Разрешите доступ «Всегда».');
  }
  try {
    if (await Geolocator.getLocationAccuracy() != LocationAccuracyStatus.precise) {
      return VisitGeoResult(radiusM: radius, error: 'Включите «Точное местоположение» для приложения.');
    }
  } catch (_) {}

  Position pos;
  try {
    pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 20),
      ),
    );
  } on TimeoutException {
    return VisitGeoResult(radiusM: radius, error: 'Сигнал GPS не найден. Выйдите на открытое место и повторите.');
  } catch (_) {
    return VisitGeoResult(radiusM: radius, error: 'Не удалось определить местоположение. Повторите.');
  }

  final error = evaluateVisitPosition(
    latitude: pos.latitude,
    longitude: pos.longitude,
    accuracyM: pos.accuracy,
    isMocked: pos.isMocked,
    radiusM: radius,
    clientLat: clientLat,
    clientLng: clientLng,
    maxAccuracyM: config?.gps.maxAccuracyM?.toDouble(),
  );
  final distance = clientLat != null && clientLng != null
      ? Geolocator.distanceBetween(pos.latitude, pos.longitude, clientLat, clientLng)
      : null;
  return VisitGeoResult(position: pos, error: error, distanceM: distance, radiusM: radius);
}
