import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

import 'external_actions.dart';

/// GPS o‘qib mijozga tashqi navigatsiya (Yandex / Google) ochadi.
Future<bool> openDirectionsToClient({
  required double latitude,
  required double longitude,
}) async {
  if (!hasValidLatLng(latitude, longitude)) return false;

  double? fromLat;
  double? fromLng;
  try {
    final granted = await Permission.location.request().isGranted;
    if (granted) {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        fromLat = last.latitude;
        fromLng = last.longitude;
      } else {
        final fix = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.medium,
            timeLimit: Duration(seconds: 6),
          ),
        );
        fromLat = fix.latitude;
        fromLng = fix.longitude;
      }
    }
  } catch (_) {}

  return launchClientDirections(
    latitude: latitude,
    longitude: longitude,
    fromLatitude: fromLat,
    fromLongitude: fromLng,
  );
}
