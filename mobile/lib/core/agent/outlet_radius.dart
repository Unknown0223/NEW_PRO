import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../config/mobile_config.dart';
import '../theme/app_colors.dart';

/// Mijoz koordinatasi va `misc.require_within_outlet_radius_m` bo‘yicha tekshiruv.
Future<bool> ensureWithinOutletRadius({
  required BuildContext context,
  required MobileConfig config,
  required double? clientLat,
  required double? clientLng,
  String blockedMessage = 'Mijozdan juda uzoqdasiz',
}) async {
  final radiusM = config.misc.requireWithinOutletRadiusM;
  if (radiusM == null || radiusM <= 0) return true;
  if (clientLat == null || clientLng == null) return true;

  final perm = await Geolocator.checkPermission();
  if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Radius tekshiruvi uchun GPS kerak'), backgroundColor: AppColors.error),
      );
    }
    return false;
  }

  final pos = await Geolocator.getCurrentPosition();
  final dist = Geolocator.distanceBetween(pos.latitude, pos.longitude, clientLat, clientLng);
  if (dist > radiusM) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$blockedMessage (${dist.round()} m, limit ${radiusM.round()} m)'),
          backgroundColor: AppColors.error,
        ),
      );
    }
    return false;
  }
  return true;
}
