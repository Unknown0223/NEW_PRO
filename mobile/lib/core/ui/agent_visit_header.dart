import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../gps/gps_tracker.dart';
import '../prefs/agent_local_prefs_provider.dart';
import '../l10n/app_strings_ru.dart';
import '../theme/app_colors.dart';
import '../theme/app_typography.dart';
import 'agent_ui_extended.dart';

/// GPS-баннер + дни недели в одном блоке (без сжатия).
class AgentVisitHeader extends ConsumerWidget {
  final bool showGps;
  final GpsStatus gpsStatus;
  final ValueChanged<int>? onDayChanged;

  const AgentVisitHeader({
    super.key,
    required this.showGps,
    required this.gpsStatus,
    this.onDayChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final calendarMode = ref.watch(agentLocalPrefsProvider).valueOrNull?.calendarMode ?? true;
    return Container(
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (showGps) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.info.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.gps_fixed,
                      size: 18,
                      color: gpsStatus == GpsStatus.tracking ? AppColors.success : AppColors.info,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        gpsStatus == GpsStatus.tracking ? S.gpsOn : S.gpsStarting,
                        style: AppTypography.bodySmall.copyWith(
                          color: AppColors.info,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
          if (calendarMode) AgentDayTabs(onChanged: onDayChanged, topPadding: showGps ? 0 : 10),
        ],
      ),
    );
  }
}
