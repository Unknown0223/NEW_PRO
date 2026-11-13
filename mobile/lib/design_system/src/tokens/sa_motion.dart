import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// Harakat tokenlari — shablon Motion Lab (`motionPresets` / `motionRules` + CSS).
class SaDurations {
  const SaDurations._();

  /// ≤120ms — tap feedback
  static const Duration fast = Duration(milliseconds: 100);
  /// Press ripple — 180ms
  static const Duration press = Duration(milliseconds: 180);
  /// Toggle / chip — 180–240ms
  static const Duration base = Duration(milliseconds: 240);
  /// Screen slide — 380ms
  static const Duration screen = Duration(milliseconds: 380);
  /// Spring pop — 420ms
  static const Duration emphatic = Duration(milliseconds: 420);
  /// Stagger rise / CSS rise-in — 550ms
  static const Duration rise = Duration(milliseconds: 550);
  static const Duration slow = Duration(milliseconds: 480);
  /// Bar grow / count-up — 900ms
  static const Duration data = Duration(milliseconds: 900);
  /// Live pulse — 2000ms infinite
  static const Duration pulse = Duration(milliseconds: 2000);
  /// Skeleton shimmer — 1600ms
  static const Duration shimmer = Duration(milliseconds: 1600);
  /// Launch sequence — 1800ms
  static const Duration launch = Duration(milliseconds: 1800);
  /// Auth launch zoom
  static const Duration launchZoom = Duration(milliseconds: 420);
  /// Soft rejim — CSS `.motion-soft` 0.26s
  static const Duration soft = Duration(milliseconds: 260);
}

class SaCurves {
  const SaCurves._();

  /// cubic-bezier(.16,1,.3,1) — au-in / screen (y≤1 — Opacity xavfsiz)
  static const Curve standard = Cubic(0.16, 0.99, 0.3, 1);
  static const Curve enter = Curves.easeOutCubic;
  /// Bounce — scale uchun; Opacity alohida clamp qilinadi.
  static const Curve pop = Cubic(0.34, 1.35, 0.64, 1);
  static const Curve press = Curves.easeOut;
  static const Curve linear = Curves.linear;
}

class SaStaggerDelay {
  const SaStaggerDelay._();

  /// Shablon `--stagger: i * 55ms`
  static const Duration step = Duration(milliseconds: 55);
  static const Duration list = Duration(milliseconds: 55);
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
    // Soft: uzun enter/screen → 260ms; qisqa presslar biroz yumshoq.
    if (normal.inMilliseconds >= 280) return SaDurations.soft;
    return Duration(milliseconds: (normal.inMilliseconds * 0.9).round());
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
