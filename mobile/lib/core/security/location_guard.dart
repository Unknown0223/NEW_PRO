import 'dart:async';
import 'dart:io';

import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import '../time/server_clock.dart';

/// Fake GPS (Mock Location), aniqlik va ServerClock farqini tekshiruvchi guard.
class LocationIntegrityGuard {
  final bool isMocked;
  final double accuracyMeters;
  final double maxAllowedAccuracyMeters;
  final DateTime clientUtc;
  final int maxClockSkewSeconds;

  const LocationIntegrityGuard({
    required this.isMocked,
    required this.accuracyMeters,
    this.maxAllowedAccuracyMeters = 100,
    required this.clientUtc,
    this.maxClockSkewSeconds = 300,
  });

  String? validate() {
    if (isMocked) {
      return 'Обнаружен Fake GPS (Mock Location). Отключите подмену геолокации.';
    }
    if (accuracyMeters > maxAllowedAccuracyMeters) {
      return 'Низкая точность GPS (${accuracyMeters.round()} м > ${maxAllowedAccuracyMeters.round()} м). Выйдите на открытое место.';
    }
    final serverNow = ServerClock.instance.bestEffortNowUtc();
    final skew = (serverNow.difference(clientUtc).inSeconds).abs();
    if (skew > maxClockSkewSeconds) {
      return 'Время телефона отличается от серверного на $skew сек. Включите авто-время.';
    }
    return null;
  }
}

/// Multi-sample GPS + Fake GPS / clock skew (HR Hub `LocationGuard` port, MethodChannel siz).
class LocationGuardException implements Exception {
  LocationGuardException(this.message);
  final String message;
  @override
  String toString() => message;
}

class PreciseFix {
  const PreciseFix({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.samples,
    required this.isMocked,
  });

  final double latitude;
  final double longitude;
  final double accuracy;
  final int samples;
  final bool isMocked;
}

class LocationGuard {
  static const _maxFixAge = Duration(seconds: 30);
  static const _warmFor = Duration(minutes: 2);

  static final _recent = <Position>[];
  static StreamSubscription<Position>? _warmSub;
  static Timer? _warmStop;

  static LocationSettings _gpsSettings() => Platform.isAndroid
      ? AndroidSettings(
          accuracy: LocationAccuracy.best,
          distanceFilter: 0,
          forceLocationManager: true,
          intervalDuration: const Duration(seconds: 1),
        )
      : const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 0);

  static bool _fresh(Position p) {
    final now = ServerClock.instance.bestEffortNowUtc();
    final ts = p.timestamp.toUtc();
    return now.difference(ts).abs() <= _maxFixAge;
  }

  /// Punch oldidan GPS ni isitish (home / resume).
  static Future<void> warmUp() async {
    _warmStop?.cancel();
    _warmStop = Timer(_warmFor, stopWarmUp);
    if (_warmSub != null) return;
    try {
      if (!await Permission.locationWhenInUse.isGranted) return;
      if (!await Geolocator.isLocationServiceEnabled()) return;
      _warmSub = Geolocator.getPositionStream(locationSettings: _gpsSettings()).listen(
        _remember,
        onError: (Object _) => stopWarmUp(),
      );
    } catch (_) {
      stopWarmUp();
    }
  }

  static void stopWarmUp() {
    _warmStop?.cancel();
    _warmStop = null;
    _warmSub?.cancel();
    _warmSub = null;
  }

  static void _remember(Position p) {
    if (!_fresh(p) || _recent.any((s) => s.timestamp == p.timestamp)) return;
    _recent
      ..add(p)
      ..removeWhere((s) => !_fresh(s));
    if (_recent.length > 10) _recent.removeRange(0, _recent.length - 10);
  }

  /// Bir necha GPS namunani yig‘ib, eng aniqlarining o‘rtachasini qaytaradi.
  Future<PreciseFix> acquire({
    Duration timeout = const Duration(seconds: 10),
    double targetAccuracy = 20,
    Duration settleAfter = const Duration(seconds: 3),
    double acceptableAccuracy = 50,
    int minSamples = 2,
    double maxAllowedAccuracyMeters = 100,
  }) async {
    final perm = await Permission.locationWhenInUse.request();
    if (!perm.isGranted) {
      throw LocationGuardException('Разрешение на геолокацию не выдано');
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw LocationGuardException('GPS выключен — включите');
    }

    final samples = <Position>[];
    final done = Completer<void>();
    final started = Stopwatch()..start();
    double bestAccuracy() =>
        samples.map((s) => s.accuracy).reduce((a, b) => a < b ? a : b);

    void checkDone() {
      if (done.isCompleted || samples.isEmpty) return;
      final settled = started.elapsed >= settleAfter;
      if (!settled && samples.length < minSamples) return;
      if (bestAccuracy() <= (settled ? acceptableAccuracy : targetAccuracy)) {
        done.complete();
      }
    }

    void add(Position p) {
      if (done.isCompleted || !_fresh(p)) return;
      samples.add(p);
      checkDone();
    }

    for (final p in _recent.where(_fresh)) {
      add(p);
    }

    final sub = Geolocator.getPositionStream(locationSettings: _gpsSettings()).listen(
      (p) {
        _remember(p);
        add(p);
      },
      onError: (Object e) {
        if (!done.isCompleted && samples.isEmpty) done.completeError(e);
      },
    );
    final settle = Timer(settleAfter, checkDone);
    try {
      await done.future.timeout(timeout, onTimeout: () {});
    } finally {
      settle.cancel();
      await sub.cancel();
    }

    if (samples.isEmpty) {
      // Fallback: bitta fused fix
      final one = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      samples.add(one);
    }

    final best = bestAccuracy();
    final good = samples.where((s) => s.accuracy <= best * 1.5 + 1).toList();
    final mocked = samples.any((s) => s.isMocked);

    var wSum = 0.0, lat = 0.0, lon = 0.0;
    for (final s in good) {
      final w = 1 / (s.accuracy * s.accuracy + 1);
      wSum += w;
      lat += s.latitude * w;
      lon += s.longitude * w;
    }

    final fix = PreciseFix(
      latitude: lat / wSum,
      longitude: lon / wSum,
      accuracy: best,
      samples: samples.length,
      isMocked: mocked,
    );

    final err = LocationIntegrityGuard(
      isMocked: fix.isMocked,
      accuracyMeters: fix.accuracy,
      maxAllowedAccuracyMeters: maxAllowedAccuracyMeters,
      clientUtc: DateTime.now().toUtc(),
    ).validate();
    if (err != null) throw LocationGuardException(err);

    return fix;
  }
}
