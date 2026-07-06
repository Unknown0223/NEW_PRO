import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

const _threeHoursSec = 3 * 3600;
const _thirtyMinSec = 30 * 60;

/// Sinхron tugashiga qolgan vaqt bo‘yicha silliq rang: yashil → sariq (3 soat) → qizil (30 daq).
Color syncCountdownUrgencyColor(Duration left, {bool isWindowStart = false}) {
  if (isWindowStart) return AppColors.info;

  final sec = left.inSeconds.clamp(0, 24 * 3600);
  if (sec > _threeHoursSec) return AppColors.agentAccent;
  if (sec > _thirtyMinSec) {
    final t = (_threeHoursSec - sec) / (_threeHoursSec - _thirtyMinSec);
    return Color.lerp(AppColors.agentAccent, AppColors.warning, t.clamp(0.0, 1.0))!;
  }
  final t = (_thirtyMinSec - sec) / _thirtyMinSec;
  return Color.lerp(AppColors.warning, AppColors.error, t.clamp(0.0, 1.0))!;
}
