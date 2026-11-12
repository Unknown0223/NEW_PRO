import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// Harakat tokenlari — shablon Motion Lab (`motionPresets` / `motionRules`).
class SaDurations {
  const SaDurations._();

  static const Duration fast = Duration(milliseconds: 100);
  static const Duration press = Duration(milliseconds: 140);
  static const Duration base = Duration(milliseconds: 200);
  /// Ekran o‘tishi — yengil
  static const Duration screen = Duration(milliseconds: 280);
  static const Duration emphatic = Duration(milliseconds: 320);
  /// au-in — mobil uchun qisqaroq (prototip 600ms)
  static const Duration rise = Duration(milliseconds: 360);
  static const Duration slow = Duration(milliseconds: 480);
  static const Duration data = Duration(milliseconds: 600);
  static const Duration pulse = Duration(milliseconds: 2000);
  static const Duration shimmer = Duration(milliseconds: 1200);
  static const Duration launch = Duration(milliseconds: 900);
  /// Auth launch — yengil fade
  static const Duration launchZoom = Duration(milliseconds: 420);
}

class SaCurves {
  const SaCurves._();

  /// cubic-bezier(.16,1,.3,1) — au-in / screen
  static const Curve standard = Cubic(0.16, 1, 0.3, 1);
  static const Curve enter = Curves.easeOutCubic;
  static const Curve pop = Cubic(0.34, 1.56, 0.64, 1);
  static const Curve press = Curves.easeOut;
  static const Curve linear = Curves.linear;
}

class SaStaggerDelay {
  const SaStaggerDelay._();

  static const Duration step = Duration(milliseconds: 40);
  static const Duration list = Duration(milliseconds: 50);
  static const Duration launchStep = Duration(milliseconds: 200);

  static Duration of(int index, {Duration step = step}) => step * index;
}

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
        // Prototip au-in: cubic-bezier(.16,1,.3,1)
        SaMotionPreset.rise => SaCurves.standard,
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

/// Prototip: full | soft | off
enum SaMotionLevel { full, soft, off }

/// Global motion sozlama — default full (emulyator animator scale=0 ni yengadi).
class SaMotionSettings {
  SaMotionSettings._();

  /// Default full — soft+a11y emulyatorda SaEnter ni o‘chirib qo‘yardi.
  static final ValueNotifier<SaMotionLevel> level =
      ValueNotifier<SaMotionLevel>(SaMotionLevel.full);

  static SaMotionLevel of(BuildContext context) {
    final inherited = SaMotionScope.maybeOf(context);
    return inherited ?? level.value;
  }
}

class SaMotionScope extends InheritedWidget {
  final SaMotionLevel level;

  const SaMotionScope({
    super.key,
    required this.level,
    required super.child,
  });

  static SaMotionLevel? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<SaMotionScope>()?.level;
  }

  @override
  bool updateShouldNotify(SaMotionScope old) => old.level != level;
}

/// Faqat [SaMotionLevel.off]. Emulyator a11y/animator scale=0
/// MediaQuery orqali SaEnter ni o‘chirmasin — product motion doim yoqiladi.
bool saReduceMotion(BuildContext context) {
  return SaMotionSettings.of(context) == SaMotionLevel.off;
}

Duration saDuration(BuildContext context, Duration normal) {
  if (saReduceMotion(context)) return Duration.zero;
  final level = SaMotionSettings.of(context);
  if (level == SaMotionLevel.soft) {
    return Duration(milliseconds: (normal.inMilliseconds * 0.85).round());
  }
  return normal;
}

Curve saCurve(BuildContext context, Curve normal) {
  return saReduceMotion(context) ? Curves.linear : normal;
}

/// MaterialApp builder uchun — product motion yoqiladi.
MediaQueryData saMotionMediaQuery(MediaQueryData raw, SaMotionLevel level) {
  if (level == SaMotionLevel.off) {
    return raw.copyWith(disableAnimations: true);
  }
  // Emulator/dev: force animations on.
  return raw.copyWith(disableAnimations: false);
}

/// timeDilation soft rejim uchun (ixtiyoriy).
void saApplyMotionScheduler(SaMotionLevel level) {
  timeDilation = switch (level) {
    SaMotionLevel.full => 1.0,
    SaMotionLevel.soft => 1.0,
    SaMotionLevel.off => 1.0,
  };
}
