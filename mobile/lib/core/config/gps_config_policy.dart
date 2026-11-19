import 'package:geolocator/geolocator.dart';

import 'mobile_config.dart';

class GpsPositionCheck {
  final bool ok;
  final String? message;
  const GpsPositionCheck({required this.ok, this.message});
}

GpsPositionCheck checkGpsPosition(GpsConfig gps, Position position) {
  final maxAcc = gps.maxAccuracyM;
  if (maxAcc != null && maxAcc > 0 && position.accuracy > maxAcc) {
    return GpsPositionCheck(
      ok: false,
      message: 'GPS aniqligi yetarli emas (≤ ${maxAcc.toStringAsFixed(0)} m)',
    );
  }
  return const GpsPositionCheck(ok: true);
}

bool shouldTrackGpsAlways(GpsConfig gps) => gps.trackingEnabled && (gps.alwaysOn || gps.trackingEnabled);

bool requiresInternetForAgent(GpsConfig gps) =>
    gps.internetRequiredForOrder || gps.internetAlwaysOn;
