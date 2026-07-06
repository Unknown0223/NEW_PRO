import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../../core/map/route_map_stop.dart';

/// Agent joriy GPS — marshrut boshlanish nuqtasi (optimal tartib uchun).
final agentRouteStartProvider = FutureProvider<RouteMapStop?>((ref) async {
  try {
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      return null;
    }
    if (!await Geolocator.isLocationServiceEnabled()) return null;

    final last = await Geolocator.getLastKnownPosition();
    if (last != null && (last.latitude != 0 || last.longitude != 0)) {
      return RouteMapStop(
        name: 'Boshlanish',
        latitude: last.latitude,
        longitude: last.longitude,
        orderIndex: 0,
      );
    }

    final pos = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.medium,
        timeLimit: Duration(seconds: 6),
      ),
    ).timeout(const Duration(seconds: 6));

    if (pos.latitude == 0 && pos.longitude == 0) return null;
    return RouteMapStop(
      name: 'Boshlanish',
      latitude: pos.latitude,
      longitude: pos.longitude,
      orderIndex: 0,
    );
  } catch (_) {
    return null;
  }
});
