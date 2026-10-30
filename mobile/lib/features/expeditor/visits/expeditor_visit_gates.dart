import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/mobile_api.dart';
import '../../../core/auth/session.dart';
import '../../../core/config/gps_config_policy.dart';
import '../../../core/gps/gps_tracker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/visits/visit_geo_check.dart';
import '../../agent/clients/client_photo_report_flow.dart';
import '../config/expeditor_config_enforcement.dart';
import 'expeditor_photo_flow.dart';

class ExpeditorVisitGateResult {
  final bool ok;
  final String? message;
  final double? latitude;
  final double? longitude;

  /// true — vizitga shu qurilma koordinatasini yozish (mijoz koordinatasi emas).
  final bool replacePosition;
  final bool photoTaken;

  const ExpeditorVisitGateResult({
    required this.ok,
    this.message,
    this.latitude,
    this.longitude,
    this.replacePosition = false,
    this.photoTaken = false,
  });
}

/// Foto, GPS va radius. Server ham shu qoidalarni qayta tekshiradi.
Future<ExpeditorVisitGateResult> ensureExpeditorVisitAllowed({
  required BuildContext context,
  required WidgetRef ref,
  required int clientId,
  double? clientLat,
  double? clientLng,
}) async {
  final cfg = ref.read(sessionProvider).mobileConfig;
  final policy = ExpeditorConfigPolicy.fromMobileConfig(cfg);
  var photoTaken = false;
  if (policy.photoRequired) {
    final photo = await _ensureOwnPhotoToday(context, ref, clientId);
    if (!photo.ok || !context.mounted) {
      return const ExpeditorVisitGateResult(
        ok: false,
        message: 'Сначала добавьте фотоотчёт',
      );
    }
    photoTaken = photo.taken;
  }

  final radius = cfg?.misc.requireWithinOutletRadiusM;
  final gpsRequired = cfg?.gps.requiredForOrder == true;
  final radiusOn = radius != null && radius > 0;
  if (!radiusOn && !gpsRequired) {
    return ExpeditorVisitGateResult(ok: true, photoTaken: photoTaken);
  }

  // Yangi sun'iy yo'ldoshni 20 soniya kutmaymiz — kesh yoki oxirgi nuqta.
  final pos = await ref.read(gpsTrackerProvider.notifier).getQuickPosition();
  if (!context.mounted) return const ExpeditorVisitGateResult(ok: false);
  if (pos == null) {
    return const ExpeditorVisitGateResult(
      ok: false,
      message: 'Не удалось определить местоположение',
    );
  }
  if (radiusOn) {
    final err = evaluateVisitPosition(
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracyM: pos.accuracy,
      isMocked: pos.isMocked,
      radiusM: radius,
      clientLat: clientLat,
      clientLng: clientLng,
      maxAccuracyM: cfg?.gps.maxAccuracyM?.toDouble(),
    );
    if (err != null) {
      return ExpeditorVisitGateResult(ok: false, message: err);
    }
  } else {
    final check = checkGpsPosition(cfg!.gps, pos);
    if (!check.ok) {
      return ExpeditorVisitGateResult(
        ok: false,
        message: check.message ?? 'Недостаточная точность GPS',
      );
    }
  }
  return ExpeditorVisitGateResult(
    ok: true,
    latitude: pos.latitude,
    longitude: pos.longitude,
    replacePosition: true,
    photoTaken: photoTaken,
  );
}

Future<({bool ok, bool taken})> _ensureOwnPhotoToday(
  BuildContext context,
  WidgetRef ref,
  int clientId,
) async {
  final slug = ref.read(sessionProvider).tenantSlug ?? '';
  final userId = ref.read(sessionProvider).user?.id;
  if (slug.isEmpty) return (ok: false, taken: false);
  var hasToday = false;
  try {
    final photos = await ref.read(mobileApiProvider).getClientPhotoReports(slug, clientId);
    hasToday = hasPhotoReportToday(photos, ownerUserId: userId);
  } catch (_) {
    hasToday = false;
  }
  if (hasToday) return (ok: true, taken: false);
  if (!context.mounted) return (ok: false, taken: false);
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => Dialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: const BoxDecoration(
                color: AppColors.expeditorAccent,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.photo_camera_outlined, color: Colors.white, size: 30),
            ),
            const SizedBox(height: 16),
            const Text(
              'Нужен фотоотчёт',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              'Перед визитом необходимо добавить сегодняшний фотоотчёт. Сделать фото сейчас?',
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.expeditorAccent,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Сделать фото', style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Отмена')),
          ],
        ),
      ),
    ),
  );
  if (ok != true || !context.mounted) return (ok: false, taken: false);
  final uploaded = await captureAndUploadExpeditorPhoto(
    context: context,
    ref: ref,
    slug: slug,
    clientId: clientId,
  );
  return (ok: uploaded != null, taken: uploaded != null);
}

/// Vizit taymeri o‘z ichida yangilanadi — butun sahifa har soniyada qayta chizilmaydi.
class ExpeditorSessionClock extends StatefulWidget {
  final DateTime startedAt;

  const ExpeditorSessionClock({super.key, required this.startedAt});

  @override
  State<ExpeditorSessionClock> createState() => _ExpeditorSessionClockState();
}

class _ExpeditorSessionClockState extends State<ExpeditorSessionClock> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final elapsed = DateTime.now().difference(widget.startedAt);
    final minutes = elapsed.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = elapsed.inSeconds.remainder(60).toString().padLeft(2, '0');
    final hours = elapsed.inHours;
    final text = hours > 0 ? '${hours.toString().padLeft(2, '0')}:$minutes:$seconds' : '$minutes:$seconds';
    const timeStyle = TextStyle(
      fontWeight: FontWeight.w800,
      color: AppColors.textHeadline,
      fontFeatures: [FontFeature.tabularFigures()],
    );
    return Text.rich(
      TextSpan(
        text: 'Время сеанса: ',
        style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
        children: [TextSpan(text: text, style: timeStyle)],
      ),
      maxLines: 1,
      overflow: TextOverflow.fade,
      softWrap: false,
    );
  }
}
