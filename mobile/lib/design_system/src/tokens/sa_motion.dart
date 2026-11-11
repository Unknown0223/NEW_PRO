import 'package:flutter/material.dart';

/// Harakat tokenlari — shablon Motion Lab (`motionPresets` / `motionRules`) bilan bir xil.
class SaDurations {
  const SaDurations._();

  /// Tap / press feedback (≤120ms)
  static const Duration fast = Duration(milliseconds: 120);

  /// Press ripple
  static const Duration press = Duration(milliseconds: 180);

  /// Toggle, chip, checkbox (180–240ms)
  static const Duration base = Duration(milliseconds: 240);

  /// Ekran slide
  static const Duration screen = Duration(milliseconds: 380);

  /// Sheet / FAB spring, urg‘uli
  static const Duration emphatic = Duration(milliseconds: 420);

  /// Stagger rise to‘liq
  static const Duration rise = Duration(milliseconds: 520);

  /// Faqat ma’lumot / loading
  static const Duration slow = Duration(milliseconds: 600);

  /// Bar grow / count-up
  static const Duration data = Duration(milliseconds: 900);

  /// Live pulse
  static const Duration pulse = Duration(milliseconds: 2000);

  /// Skeleton shimmer
  static const Duration shimmer = Duration(milliseconds: 1600);

  /// Launch sequence (3 bosqich)
  static const Duration launch = Duration(milliseconds: 1800);
}

class SaCurves {
  const SaCurves._();

  /// cubic-bezier(.16,1,.3,1) — screen / standard
  static const Curve standard = Cubic(0.16, 1, 0.3, 1);

  /// ease-out — rise, grow
  static const Curve enter = Curves.easeOutCubic;

  /// spring(0.34, 1.56) — pop / sheet
  static const Curve pop = Cubic(0.34, 1.56, 0.64, 1);

  /// Press ripple
  static const Curve press = Curves.easeOut;

  /// Shimmer linear
  static const Curve linear = Curves.linear;
}

/// Stagger oralig‘i (rise: 60–80ms).
class SaStaggerDelay {
  const SaStaggerDelay._();

  static const Duration step = Duration(milliseconds: 60);
  static const Duration list = Duration(milliseconds: 80);
  static const Duration launchStep = Duration(milliseconds: 350);

  static Duration of(int index, {Duration step = step}) => step * index;
}

/// Shablon Motion Lab presetlari (id → maqsad).
enum SaMotionPreset {
  spring,
  rise,
  screen,
  grow,
  pulse,
  shimmer,
  press,
  count,
  tilt,
  launch,
}

extension SaMotionPresetX on SaMotionPreset {
  Duration get duration => switch (this) {
        SaMotionPreset.spring => SaDurations.emphatic,
        SaMotionPreset.rise => SaDurations.rise,
        SaMotionPreset.screen => SaDurations.screen,
        SaMotionPreset.grow => SaDurations.data,
        SaMotionPreset.pulse => SaDurations.pulse,
        SaMotionPreset.shimmer => SaDurations.shimmer,
        SaMotionPreset.press => SaDurations.press,
        SaMotionPreset.count => SaDurations.data,
        SaMotionPreset.tilt => SaDurations.base,
        SaMotionPreset.launch => SaDurations.launch,
      };

  Curve get curve => switch (this) {
        SaMotionPreset.spring => SaCurves.pop,
        SaMotionPreset.rise => SaCurves.enter,
        SaMotionPreset.screen => SaCurves.standard,
        SaMotionPreset.grow => SaCurves.enter,
        SaMotionPreset.pulse => SaCurves.standard,
        SaMotionPreset.shimmer => SaCurves.linear,
        SaMotionPreset.press => SaCurves.press,
        SaMotionPreset.count => SaCurves.enter,
        SaMotionPreset.tilt => SaCurves.press,
        SaMotionPreset.launch => SaCurves.standard,
      };
}

/// Foydalanuvchi tizimda harakatni o‘chirgan bo‘lsa true.
bool saReduceMotion(BuildContext context) {
  return MediaQuery.disableAnimationsOf(context);
}

/// Harakat sozlamasiga qarab davomiylik.
Duration saDuration(BuildContext context, Duration normal) {
  return saReduceMotion(context) ? Duration.zero : normal;
}

Curve saCurve(BuildContext context, Curve normal) {
  return saReduceMotion(context) ? Curves.linear : normal;
}
