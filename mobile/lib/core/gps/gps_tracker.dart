import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../api/field_api.dart';
import '../auth/session.dart';
import '../config/gps_config_policy.dart';
import '../config/mobile_config.dart';
import '../errors/error_reporter.dart';

enum GpsStatus { unknown, disabled, denied, granted, tracking }

/// Mijozga nuqta biriktirish: nima uchun GPS olinmadi.
enum GpsAttachIssue { serviceOff, denied, deniedForever, noFix }

class GpsAttachOutcome {
  final Position? position;
  final GpsAttachIssue? issue;

  const GpsAttachOutcome._({this.position, this.issue});

  factory GpsAttachOutcome.ok(Position position) => GpsAttachOutcome._(position: position);

  factory GpsAttachOutcome.fail(GpsAttachIssue issue) => GpsAttachOutcome._(issue: issue);

  bool get ok => position != null;

  String get message {
    switch (issue) {
      case GpsAttachIssue.serviceOff:
        return 'Joylashuv o‘chirilgan. Telefon sozlamalarida GPS ni yoqing.';
      case GpsAttachIssue.denied:
        return 'GPS ruxsatini bering — keyin qayta bosing.';
      case GpsAttachIssue.deniedForever:
        return 'GPS ruxsati yopilgan. Ilova sozlamalaridan ruxsatni yoqing.';
      case GpsAttachIssue.noFix:
        return 'GPS signali topilmadi. Ochiq joyda qayta bosing.';
      case null:
        return '';
    }
  }
}

class GpsState {
  final GpsStatus status;
  final Position? lastPosition;
  final DateTime? lastPingAt;

  const GpsState({this.status = GpsStatus.unknown, this.lastPosition, this.lastPingAt});

  GpsState copyWith({GpsStatus? status, Position? lastPosition, DateTime? lastPingAt}) {
    return GpsState(
      status: status ?? this.status,
      lastPosition: lastPosition ?? this.lastPosition,
      lastPingAt: lastPingAt ?? this.lastPingAt,
    );
  }
}

class GpsTracker extends StateNotifier<GpsState> {
  final FieldApi _fieldApi;
  final GpsConfig _config;
  final String _slug;
  Timer? _timer;
  bool _disposed = false;
  Position? _lastSentPosition;

  GpsTracker({
    required FieldApi fieldApi,
    required GpsConfig config,
    required String slug,
  })  : _fieldApi = fieldApi,
        _config = config,
        _slug = slug,
        super(const GpsState());

  bool get isTracking => _timer != null && _timer!.isActive;
  bool get isEnabled => _config.trackingEnabled;

  Future<bool> requestPermission() async {
    if (_disposed) return false;
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (_disposed) return false;
    if (!serviceEnabled) {
      state = state.copyWith(status: GpsStatus.disabled);
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (_disposed) return false;
    if (permission == LocationPermission.deniedForever ||
        permission == LocationPermission.denied) {
      state = state.copyWith(status: GpsStatus.denied);
      return false;
    }

    state = state.copyWith(status: GpsStatus.granted);
    return true;
  }

  Future<void> startTracking() async {
    if (_disposed || (!_config.trackingEnabled && !_config.alwaysOn)) return;
    if (!await requestPermission()) return;
    if (_disposed) return;

    stopTracking();

    await _sendPing();
    if (_disposed) return;

    final interval = Duration(seconds: _config.trackingIntervalSec);
    _timer = Timer.periodic(interval, (_) => _sendPing());

    if (!_disposed) {
      state = state.copyWith(status: GpsStatus.tracking);
    }
  }

  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    if (!_disposed && state.status == GpsStatus.tracking) {
      state = state.copyWith(status: GpsStatus.granted);
    }
  }

  Future<Position?> getCurrentPosition() async {
    final attached = await attachCurrentPosition();
    return attached.position;
  }

  /// Savdo nuqtasi GPS — ruxsat / o‘chiq GPS / signal yo‘qni alohida qaytaradi.
  /// High+10s timeout hammasi «ruxsat yo‘q» deb ko‘rinmasin.
  Future<GpsAttachOutcome> attachCurrentPosition() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (_disposed) return GpsAttachOutcome.fail(GpsAttachIssue.noFix);
      if (!serviceEnabled) {
        state = state.copyWith(status: GpsStatus.disabled);
        ErrorReporter.instance?.reportModuleIssue(
          module: ErrorModules.gps,
          code: 'GpsServiceOff',
          message: 'GPS: служба геолокации выключена',
          path: '/mobile/gps',
          severity: 'warning',
        );
        return GpsAttachOutcome.fail(GpsAttachIssue.serviceOff);
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (_disposed) return GpsAttachOutcome.fail(GpsAttachIssue.noFix);
      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(status: GpsStatus.denied);
        ErrorReporter.instance?.reportModuleIssue(
          module: ErrorModules.gps,
          code: 'GpsDeniedForever',
          message: 'GPS: доступ запрещён навсегда',
          path: '/mobile/gps',
          severity: 'warning',
        );
        return GpsAttachOutcome.fail(GpsAttachIssue.deniedForever);
      }
      if (permission == LocationPermission.denied) {
        state = state.copyWith(status: GpsStatus.denied);
        ErrorReporter.instance?.reportModuleIssue(
          module: ErrorModules.gps,
          code: 'GpsDenied',
          message: 'GPS: доступ отклонён',
          path: '/mobile/gps',
          severity: 'warning',
        );
        return GpsAttachOutcome.fail(GpsAttachIssue.denied);
      }

      state = state.copyWith(status: GpsStatus.granted);

      Position? lastKnown;
      try {
        lastKnown = await Geolocator.getLastKnownPosition();
      } catch (_) {}

      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.medium,
            timeLimit: Duration(seconds: 8),
          ),
        );
        return GpsAttachOutcome.ok(pos);
      } on TimeoutException {
        if (lastKnown != null) return GpsAttachOutcome.ok(lastKnown);
        ErrorReporter.instance?.reportModuleIssue(
          module: ErrorModules.gps,
          code: 'GpsNoFixTimeout',
          message: 'GPS: таймаут фиксации позиции',
          path: '/mobile/gps',
          severity: 'warning',
        );
        return GpsAttachOutcome.fail(GpsAttachIssue.noFix);
      }
    } catch (e, st) {
      try {
        final lastKnown = await Geolocator.getLastKnownPosition();
        if (lastKnown != null) return GpsAttachOutcome.ok(lastKnown);
      } catch (_) {}
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.gps,
        code: 'GpsAttachFailed',
        message: 'GPS: не удалось получить позицию',
        path: '/mobile/gps',
        severity: 'warning',
      );
      return GpsAttachOutcome.fail(GpsAttachIssue.noFix);
    }
  }

  /// Tezkor lokatsiya — vizit boshlash kabi amallar uchun. Aniq GPS fix'ini
  /// (10s gacha) kutib o'tirmaydi: 1) tracker keshidagi yangi koordinatani,
  /// 2) OS'ning oxirgi ma'lum koordinatasini, 3) bo'lmasa qisqa timeout bilan
  /// medium aniqlikni qaytaradi. Shunda tugma deyarli darhol ishlaydi.
  Future<Position?> getQuickPosition() async {
    final cached = state.lastPosition;
    final pingAt = state.lastPingAt;
    if (cached != null &&
        pingAt != null &&
        DateTime.now().difference(pingAt) <= const Duration(seconds: 120)) {
      return cached;
    }
    try {
      if (!await requestPermission()) return cached;
      final lastKnown = await Geolocator.getLastKnownPosition();
      if (lastKnown != null) return lastKnown;
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );
    } catch (_) {
      return cached;
    }
  }

  /// Check if within radius of target point
  bool isWithinRadius(double lat1, double lng1, double lat2, double lng2, int radiusMeters) {
    final distance = Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
    return distance <= radiusMeters;
  }

  /// Get distance between two points in meters
  double distanceBetween(double lat1, double lng1, double lat2, double lng2) {
    return Geolocator.distanceBetween(lat1, lng1, lat2, lng2);
  }

  /// Send GPS ping to backend
  Future<void> _sendPing() async {
    if (_disposed) return;
    try {
      final position = await getCurrentPosition();
      if (position == null || _disposed) return;

      final accuracyCheck = checkGpsPosition(_config, position);
      if (!accuracyCheck.ok) return;

      final minDist = _config.minDistanceM;
      if (minDist != null && minDist > 0 && _lastSentPosition != null) {
        final moved = distanceBetween(
          _lastSentPosition!.latitude,
          _lastSentPosition!.longitude,
          position.latitude,
          position.longitude,
        );
        if (moved < minDist) return;
      }

      state = state.copyWith(lastPosition: position, lastPingAt: DateTime.now());
      _lastSentPosition = position;

      if (_slug.isNotEmpty) {
        await _fieldApi.sendLocation(
          _slug,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracyMeters: position.accuracy,
        );
      }
    } catch (e, st) {
      // Silently fail — will retry next interval; jurnalga yozamiz (12s dedupe).
      ErrorReporter.instance?.reportCaught(
        e,
        stack: st,
        module: ErrorModules.gps,
        code: 'GpsPingFailed',
        message: 'GPS: ping на сервер не отправился',
        path: '/mobile/field/location',
        severity: 'warning',
      );
    }
  }

  @override
  void dispose() {
    _disposed = true;
    stopTracking();
    super.dispose();
  }
}

/// GPS tracker provider — reads config from session
final gpsTrackerProvider = StateNotifierProvider<GpsTracker, GpsState>((ref) {
  final slug = ref.watch(sessionProvider.select((s) => s.tenantSlug ?? ''));
  final gps = ref.watch(sessionProvider.select((s) => s.mobileConfig?.gps ?? const GpsConfig()));

  return GpsTracker(
    fieldApi: ref.read(fieldApiProvider),
    config: gps,
    slug: slug,
  );
});
